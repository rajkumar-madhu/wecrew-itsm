// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Outbound Webhook Dispatcher
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Dispatch an event to all active IntegrationWebhook subscribers.
 * Fire-and-forget: errors are logged but never thrown.
 *
 * @param {string} eventType  - e.g. 'VOICE_CALL_COMPLETED'
 * @param {object} payload    - JSON-serialisable event body
 */
async function dispatchEvent(eventType, payload) {
  let webhooks = [];

  try {
    webhooks = await prisma.integrationWebhook.findMany({
      where: { isActive: true, events: { contains: eventType } },
    });
  } catch (err) {
    logger.error(`[webhookDispatcher] Failed to query webhooks for ${eventType}: ${err.message}`);
    return;
  }

  if (!webhooks.length) return;

  const body = JSON.stringify({ event: eventType, ...payload });

  await Promise.allSettled(
    webhooks.map(async (wh) => {
      const headers = { 'Content-Type': 'application/json' };

      if (wh.secret) {
        const sig = crypto
          .createHmac('sha256', wh.secret)
          .update(body)
          .digest('hex');
        headers['X-LinkedEye-Signature'] = `sha256=${sig}`;
      }

      try {
        await axios.post(wh.url, JSON.parse(body), { headers, timeout: 10000 });

        await prisma.integrationWebhook.update({
          where: { id: wh.id },
          data: { lastTriggered: new Date() },
        });

        logger.info(`[webhookDispatcher] Dispatched ${eventType} → ${wh.url}`);
      } catch (err) {
        logger.error(`[webhookDispatcher] Failed to deliver ${eventType} to ${wh.url}: ${err.message}`);
      }
    })
  );
}

module.exports = { dispatchEvent };
