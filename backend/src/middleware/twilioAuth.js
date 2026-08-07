// ═══════════════════════════════════════════════════════════
// Argus ITSM — Twilio Webhook Signature Verification
// ═══════════════════════════════════════════════════════════
//
// Validates X-Twilio-Signature header using HMAC-SHA1.
// See: https://www.twilio.com/docs/usage/security#validating-requests

const crypto = require('crypto');
const { config } = require('../config/env');
const logger = require('../utils/logger');

const PUBLIC_BASE = process.env.PUBLIC_URL || 'https://fs-le-dev-inc.finspot.in';

function validateTwilioSignature(req, res, next) {
  const authToken = config.twilio.authToken;

  // Skip validation if Twilio is not configured (local dev)
  if (!authToken) return next();

  const signature = req.headers['x-twilio-signature'];
  if (!signature) {
    logger.warn(`Twilio webhook missing X-Twilio-Signature: ${req.originalUrl}`);
    res.status(403).set('Content-Type', 'text/xml');
    return res.send('<Response><Say>Unauthorized request.</Say><Hangup/></Response>');
  }

  // Reconstruct the URL Twilio signed (must match the public URL, not internal)
  const url = PUBLIC_BASE + req.originalUrl;

  // Build data string: URL + sorted POST param key-value pairs
  let data = url;
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).sort().forEach(key => {
      data += key + req.body[key];
    });
  }

  const computed = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  if (computed !== signature) {
    logger.warn(`Twilio signature mismatch: ${req.originalUrl} (expected=${computed.substring(0, 8)}... got=${signature.substring(0, 8)}...)`);
    res.status(403).set('Content-Type', 'text/xml');
    return res.send('<Response><Say>Unauthorized request.</Say><Hangup/></Response>');
  }

  next();
}

module.exports = { validateTwilioSignature };
