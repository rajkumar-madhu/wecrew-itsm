// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Razorpay wrapper
//
// Subscriptions and Orders sign DIFFERENT, REVERSED payloads:
//   orders:        hmac(order_id + '|' + payment_id)
//   subscriptions: hmac(payment_id + '|' + subscription_id)
// Verified against razorpay-node/lib/utils/razorpay-utils.js.
// The public Standard Checkout doc shows only the orders form.
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const Razorpay = require('razorpay');
const { config } = require('../config/env');

let client = null;
function getClient() {
  if (!client) {
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
    }
    client = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return client;
}

function getKeyId() {
  return config.razorpay.keyId;
}

/** Constant-time compare that never throws on malformed hex. */
function safeEqual(expected, received) {
  if (typeof received !== 'string' || received.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'));
  } catch {
    return false;
  }
}

function verifySubscriptionSignature({ paymentId, subscriptionId, signature }) {
  if (!paymentId || !subscriptionId || !signature || !config.razorpay.keySecret) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest('hex');
  return safeEqual(expected, signature);
}

function verifyWebhookSignature(rawBody, signature) {
  if (!rawBody || !signature || !config.razorpay.webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return safeEqual(expected, signature);
}

async function createCustomer({ name, email, contact }) {
  return getClient().customers.create({
    name, email, contact: contact || undefined, fail_existing: 0,
  });
}

async function createSubscription({ planId, organizationId, customerNotify = 1 }) {
  return getClient().subscriptions.create({
    plan_id: planId,
    total_count: 10,          // 10 yearly cycles
    quantity: 1,              // flat tier — never per-seat
    customer_notify: customerNotify,
    notes: { organizationId }, // lets the webhook find the org before we persist the id
  });
}

async function cancelSubscription(subscriptionId, cancelAtCycleEnd = true) {
  return getClient().subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}

module.exports = {
  getKeyId, verifySubscriptionSignature, verifyWebhookSignature,
  createCustomer, createSubscription, cancelSubscription,
};
