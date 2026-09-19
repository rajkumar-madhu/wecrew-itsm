const crypto = require('crypto');

jest.mock('razorpay', () => jest.fn().mockImplementation(() => ({
  customers: { create: jest.fn() },
  subscriptions: { create: jest.fn(), cancel: jest.fn() },
})));

jest.mock('../../config/env', () => ({
  config: { razorpay: { keyId: 'rzp_test_key', keySecret: 'secret123', webhookSecret: 'whsec456' } },
}));

const { verifySubscriptionSignature, verifyWebhookSignature } = require('../razorpay.service');

const sign = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

describe('verifySubscriptionSignature', () => {
  const paymentId = 'pay_IDZNwZZFtnjyym';
  const subscriptionId = 'sub_ID6MOhgkcoHj9I';

  it('accepts payment_id|subscription_id — NOT the orders order_id|payment_id form', () => {
    const good = sign(`${paymentId}|${subscriptionId}`, 'secret123');
    expect(verifySubscriptionSignature({ paymentId, subscriptionId, signature: good })).toBe(true);
  });

  it('rejects the reversed (orders-style) concatenation', () => {
    const wrong = sign(`${subscriptionId}|${paymentId}`, 'secret123');
    expect(verifySubscriptionSignature({ paymentId, subscriptionId, signature: wrong })).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const wrong = sign(`${paymentId}|${subscriptionId}`, 'not-the-secret');
    expect(verifySubscriptionSignature({ paymentId, subscriptionId, signature: wrong })).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    expect(verifySubscriptionSignature({ paymentId, subscriptionId, signature: 'zz' })).toBe(false);
    expect(verifySubscriptionSignature({ paymentId, subscriptionId, signature: '' })).toBe(false);
    expect(verifySubscriptionSignature({ paymentId, subscriptionId })).toBe(false);
  });
});

describe('verifyWebhookSignature', () => {
  const raw = Buffer.from(JSON.stringify({ event: 'subscription.charged' }));

  it('accepts a correctly signed raw body', () => {
    expect(verifyWebhookSignature(raw, sign(raw, 'whsec456'))).toBe(true);
  });

  it('rejects a body signed with the payment key secret', () => {
    expect(verifyWebhookSignature(raw, sign(raw, 'secret123'))).toBe(false);
  });

  it('rejects a tampered body', () => {
    const good = sign(raw, 'whsec456');
    expect(verifyWebhookSignature(Buffer.from('{"event":"evil"}'), good)).toBe(false);
  });
});
