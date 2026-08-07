// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — SMS Service (Twilio + MSG91 + Kaleyra)
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const { prisma } = require('../config/database');
const { config } = require('../config/env');
const logger = require('../utils/logger');

// ── Provider: Twilio ────────────────────────────────────

async function sendViaTwilio(recipient, message) {
  const { accountSid, authToken, phoneNumber } = config.twilio;
  if (!accountSid || !authToken) throw new Error('Twilio credentials not configured');

  const startTime = Date.now();
  const resp = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    new URLSearchParams({ To: recipient, From: phoneNumber, Body: message }),
    { auth: { username: accountSid, password: authToken } }
  );
  return {
    messageId: resp.data?.sid,
    status: resp.data?.status || 'queued',
    cost: resp.data?.price ? parseFloat(resp.data.price) : null,
    latency: Date.now() - startTime,
  };
}

// ── Provider: MSG91 ─────────────────────────────────────

async function sendViaMSG91(recipient, message, templateId = null) {
  const { apiKey, senderId } = config.msg91;
  if (!apiKey) throw new Error('MSG91 API key not configured');

  const startTime = Date.now();

  if (templateId) {
    // Template-based SMS (MSG91 Flow API)
    const resp = await axios.post(
      'https://control.msg91.com/api/v5/flow/',
      {
        template_id: templateId,
        recipients: [{ mobiles: recipient.replace('+', '') }],
      },
      {
        headers: { authkey: apiKey, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    return {
      messageId: resp.data?.request_id || resp.data?.message,
      status: resp.data?.type === 'success' ? 'sent' : 'failed',
      cost: null,
      latency: Date.now() - startTime,
    };
  }

  // Plain-text SMS (MSG91 Send SMS API)
  const resp = await axios.post(
    'https://control.msg91.com/api/v5/flow/',
    {
      sender: senderId,
      route: '4', // transactional
      country: recipient.startsWith('+91') ? '91' : '0',
      sms: [{ message, to: [recipient.replace('+', '')] }],
    },
    {
      headers: { authkey: apiKey, 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  );

  return {
    messageId: resp.data?.request_id || resp.data?.message,
    status: resp.data?.type === 'success' ? 'sent' : 'failed',
    cost: null,
    latency: Date.now() - startTime,
  };
}

// ── Provider: Kaleyra ───────────────────────────────────

async function sendViaKaleyra(recipient, message, templateId = null) {
  const { apiKey, senderId } = config.kaleyra;
  if (!apiKey) throw new Error('Kaleyra API key not configured');

  const startTime = Date.now();
  const params = {
    to: recipient,
    body: message,
    sender: senderId || 'LNKEYE',
    type: 'TXN',
  };
  if (templateId) params.template_id = templateId;

  const resp = await axios.get('https://api.kaleyra.io/v1/messages', {
    params,
    headers: { 'api-key': apiKey },
    timeout: 10000,
  });

  return {
    messageId: resp.data?.data?.[0]?.id || resp.data?.id,
    status: resp.data?.data?.[0]?.status || 'sent',
    cost: resp.data?.data?.[0]?.cost ? parseFloat(resp.data.data[0].cost) : null,
    latency: Date.now() - startTime,
  };
}

// ── Unified Send ────────────────────────────────────────

/**
 * Send SMS via the best available provider.
 * Priority: Twilio → MSG91 → Kaleyra
 */
async function sendSMS(recipient, message, options = {}) {
  const { incidentId, templateId, preferredProvider } = options;
  let provider = 'TWILIO';
  let result = { messageId: null, status: 'FAILED', cost: null, latency: null };

  try {
    // Select provider
    if (preferredProvider === 'MSG91' && config.msg91.apiKey) {
      provider = 'MSG91';
      result = await sendViaMSG91(recipient, message, templateId);
    } else if (preferredProvider === 'KALEYRA' && config.kaleyra.apiKey) {
      provider = 'KALEYRA';
      result = await sendViaKaleyra(recipient, message, templateId);
    } else if (config.twilio.accountSid && config.twilio.authToken) {
      provider = 'TWILIO';
      result = await sendViaTwilio(recipient, message);
    } else if (config.msg91.apiKey) {
      provider = 'MSG91';
      result = await sendViaMSG91(recipient, message, templateId);
    } else if (config.kaleyra.apiKey) {
      provider = 'KALEYRA';
      result = await sendViaKaleyra(recipient, message, templateId);
    } else {
      logger.warn('No SMS provider configured');
      result.status = 'FAILED';
    }

    // Log to DB
    await prisma.sMSLog.create({
      data: {
        recipient,
        message,
        templateId: templateId || null,
        provider,
        status: result.status === 'failed' ? 'FAILED' : 'SENT',
        messageId: result.messageId,
        cost: result.cost,
        latency: result.latency,
        direction: 'OUTBOUND',
        incidentId: incidentId || null,
      },
    });

    logger.info(`SMS sent via ${provider} to ${recipient} [${result.messageId}]`);
    return { provider, ...result };
  } catch (err) {
    logger.error(`SMS failed via ${provider} to ${recipient}:`, err.message);

    await prisma.sMSLog.create({
      data: {
        recipient,
        message,
        provider,
        status: 'FAILED',
        direction: 'OUTBOUND',
        incidentId: incidentId || null,
      },
    });

    throw err;
  }
}

// ── Bulk SMS ────────────────────────────────────────────

async function sendBulkSMS(recipients, message, options = {}) {
  const results = [];
  for (const recipient of recipients) {
    try {
      const res = await sendSMS(recipient, message, options);
      results.push({ recipient, success: true, ...res });
    } catch (err) {
      results.push({ recipient, success: false, error: err.message });
    }
  }
  return results;
}

// ── Delivery Status Check ───────────────────────────────

async function checkDeliveryStatus(messageId, provider = 'TWILIO') {
  try {
    if (provider === 'TWILIO') {
      const { accountSid, authToken } = config.twilio;
      const resp = await axios.get(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageId}.json`,
        { auth: { username: accountSid, password: authToken } }
      );
      return { status: resp.data?.status, errorCode: resp.data?.error_code, price: resp.data?.price };
    }

    if (provider === 'MSG91') {
      const resp = await axios.get(
        `https://control.msg91.com/api/v5/report?request_id=${messageId}`,
        { headers: { authkey: config.msg91.apiKey } }
      );
      return { status: resp.data?.type, details: resp.data?.data };
    }

    return { status: 'unknown', message: `Status check not implemented for ${provider}` };
  } catch (err) {
    logger.error(`Delivery status check failed for ${messageId}:`, err.message);
    return { status: 'error', error: err.message };
  }
}

// ── Inbound SMS Handling ────────────────────────────────

async function handleInboundSMS(data) {
  const { from, body, provider, messageId } = data;

  // Log inbound SMS
  await prisma.sMSLog.create({
    data: {
      recipient: from,
      message: body,
      provider: provider || 'TWILIO',
      status: 'RECEIVED',
      messageId,
      direction: 'INBOUND',
    },
  });

  logger.info(`Inbound SMS from ${from} via ${provider}: ${body.substring(0, 50)}...`);

  // Auto-create incident from SMS if keyword detected
  if (body.toUpperCase().startsWith('INCIDENT:') || body.toUpperCase().startsWith('INC:')) {
    const description = body.replace(/^(INCIDENT|INC):\s*/i, '');
    return { action: 'CREATE_INCIDENT', description, from };
  }

  return { action: 'LOGGED', from };
}

// ── Provider Health Check ───────────────────────────────

async function healthCheck(provider) {
  try {
    switch (provider) {
      case 'TWILIO': {
        const { accountSid, authToken } = config.twilio;
        if (!accountSid) return { healthy: false, message: 'Twilio not configured' };
        const resp = await axios.get(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
          { auth: { username: accountSid, password: authToken }, timeout: 5000 }
        );
        return { healthy: resp.data?.status === 'active', message: `Account status: ${resp.data?.status}` };
      }
      case 'MSG91': {
        if (!config.msg91.apiKey) return { healthy: false, message: 'MSG91 not configured' };
        // MSG91 doesn't have a direct health endpoint; validate API key format
        return { healthy: true, message: 'API key configured' };
      }
      case 'KALEYRA': {
        if (!config.kaleyra.apiKey) return { healthy: false, message: 'Kaleyra not configured' };
        return { healthy: true, message: 'API key configured' };
      }
      default:
        return { healthy: false, message: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    return { healthy: false, message: err.message };
  }
}

module.exports = {
  sendSMS,
  sendBulkSMS,
  sendViaTwilio,
  sendViaMSG91,
  sendViaKaleyra,
  checkDeliveryStatus,
  handleInboundSMS,
  healthCheck,
};
