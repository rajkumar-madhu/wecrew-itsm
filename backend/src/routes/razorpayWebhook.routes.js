// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Razorpay webhook (UNAUTHENTICATED, signature-verified)
//
// This router mounts its OWN express.raw parser. Signature verification
// needs the exact bytes Razorpay signed; once express.json() has parsed
// and re-serialised the body, key order and whitespace can differ and the
// HMAC will never match. Mount this router BEFORE express.json() in
// server.js.
//
// Idempotency: PaymentEvent.razorpayEventId is @unique and processedAt is
// only stamped after the subscription write. Razorpay retries on any
// non-2xx, so a processed duplicate is a no-op — but a retry of a delivery
// that failed mid-processing must be processed, not swallowed.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { verifyWebhookSignature } = require('../services/razorpay.service');
const { notifySubscriptionChanged } = require('../services/billing.service');

const STATUS_BY_EVENT = {
  'subscription.activated': 'ACTIVE',
  'subscription.charged': 'ACTIVE',
  'subscription.pending': 'PAST_DUE',
  'subscription.halted': 'HALTED',
  'subscription.cancelled': 'CANCELLED',
  'subscription.completed': 'EXPIRED',
};

async function markProcessed(eventId) {
  return prisma.paymentEvent.update({
    where: { razorpayEventId: eventId }, data: { processedAt: new Date() },
  });
}

/**
 * Find the row this event is about. Match on the Razorpay subscription id
 * first. Fall back to notes.organizationId only for a row that has no id
 * yet — the race where the webhook beats subscribe()'s write. Never match
 * a row that already holds a DIFFERENT id: a late event for an org's old,
 * replaced subscription would otherwise cancel or halt the live one.
 */
async function findSubscription(entity, organizationId) {
  const byId = await prisma.subscription.findFirst({ where: { razorpaySubscriptionId: entity.id } });
  if (byId || !organizationId) return byId;
  return prisma.subscription.findFirst({ where: { organizationId, razorpaySubscriptionId: null } });
}

async function handleWebhook(req, res) {
  const signature = req.get('x-razorpay-signature');
  const raw = req.body; // Buffer

  if (!Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, signature)) {
    logger.warn('[billing] rejected webhook with invalid signature');
    return res.status(400).json({ success: false, error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, error: 'Malformed JSON' });
  }

  const entity = event.payload
    && event.payload.subscription
    && event.payload.subscription.entity;

  // Razorpay's delivery id; fall back to a deterministic composite so
  // idempotency still holds if the header is absent.
  const eventId = req.get('x-razorpay-event-id')
    || `${event.event}:${entity ? entity.id : 'none'}:${event.created_at || ''}`;

  const organizationId = entity && entity.notes ? entity.notes.organizationId : null;

  try {
    await prisma.paymentEvent.create({
      data: { razorpayEventId: eventId, event: event.event, organizationId, payload: event },
    });
  } catch (err) {
    if (err.code !== 'P2002') {
      logger.error(`[billing] failed to record webhook: ${err.message}`);
      return res.status(500).json({ success: false });
    }
    let seen = null;
    try {
      seen = await prisma.paymentEvent.findUnique({ where: { razorpayEventId: eventId } });
    } catch { /* treat as unprocessed — reprocessing is idempotent */ }
    if (seen && seen.processedAt) {
      logger.info(`[billing] duplicate webhook ${eventId} ignored`);
      return res.status(200).json({ success: true, duplicate: true }); // 200 stops retries
    }
    logger.info(`[billing] retrying unprocessed webhook ${eventId}`);
  }

  const nextStatus = STATUS_BY_EVENT[event.event];
  if (!nextStatus || !entity) {
    await markProcessed(eventId).catch(() => {});
    return res.status(200).json({ success: true, ignored: true });
  }

  try {
    const sub = await findSubscription(entity, organizationId);

    if (!sub) {
      // Only an activation/charge for a new subscription can beat subscribe()'s
      // write, so only those are retried. Terminal events (cancelled, halted,
      // completed) for an unknown id are for an old, replaced subscription and
      // would never match — retrying them would get the endpoint disabled.
      logger.warn(`[billing] webhook ${event.event} for unknown subscription ${entity.id}`);
      if (organizationId && nextStatus === 'ACTIVE') {
        return res.status(500).json({ success: false, unmatched: true });
      }
      await markProcessed(eventId).catch(() => {});
      return res.status(200).json({ success: true, unmatched: true });
    }

    const data = { status: nextStatus, razorpaySubscriptionId: entity.id };

    if (entity.current_end) data.currentPeriodEnd = new Date(entity.current_end * 1000);

    if (nextStatus === 'ACTIVE' && entity.plan_id) {
      const plan = await prisma.plan.findUnique({ where: { razorpayPlanId: entity.plan_id } });
      if (plan) { data.tier = plan.tier; data.seatLimit = plan.seatLimit; }
    }

    await prisma.subscription.update({ where: { id: sub.id }, data });
    await markProcessed(eventId);
    notifySubscriptionChanged(sub.organizationId);

    logger.info(`[billing] ${event.event} → org ${sub.organizationId} is ${nextStatus}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error(`[billing] webhook processing failed: ${err.message}`);
    return res.status(500).json({ success: false }); // non-2xx → Razorpay retries
  }
}

// Express 4 does not catch a rejected async handler — the request would hang
// until Razorpay times out. Always answer, so a failure is a clean retry.
router.post('/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), (req, res) => {
  handleWebhook(req, res).catch((err) => {
    logger.error(`[billing] webhook handler crashed: ${err.message}`);
    if (!res.headersSent) res.status(500).json({ success: false });
  });
});

module.exports = router;
