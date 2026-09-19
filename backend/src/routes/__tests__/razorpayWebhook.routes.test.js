const express = require('express');
const request = require('supertest');
const crypto = require('crypto');

const mockPrisma = {
  paymentEvent: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  subscription: { findFirst: jest.fn(), update: jest.fn() },
  plan: { findUnique: jest.fn() },
};
const mockNotify = jest.fn(async () => {});
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../services/razorpay.service', () => ({
  // jest.mock factories are hoisted above the top-level require, so load crypto here.
  verifyWebhookSignature: (raw, sig) =>
    require('crypto').createHmac('sha256', 'whsec456').update(raw).digest('hex') === sig,
}));
jest.mock('../../services/billing.service', () => ({
  notifySubscriptionChanged: (...a) => mockNotify(...a),
}));

function buildApp() {
  jest.resetModules();
  const routes = require('../razorpayWebhook.routes');
  const app = express();
  app.use('/api/v1/webhooks', routes);   // router supplies its own raw parser
  return app;
}

const send = (app, payload, secret = 'whsec456') => {
  const raw = Buffer.from(JSON.stringify(payload));
  return request(app)
    .post('/api/v1/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', crypto.createHmac('sha256', secret).update(raw).digest('hex'))
    // Send the exact string: with a JSON content type, supertest serialises a
    // Buffer as {"type":"Buffer","data":[...]}, which is not the signed bytes.
    .send(raw.toString('utf8'));
};

const activatedPayload = (subId = 'sub_1') => ({
  event: 'subscription.activated',
  payload: { subscription: { entity: {
    id: subId, plan_id: 'plan_x', current_end: 1800000000,
    notes: { organizationId: 'org1' },
  } } },
});

beforeEach(() => jest.resetAllMocks());

it('rejects an unsigned request with 400', async () => {
  const res = await request(buildApp())
    .post('/api/v1/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .send('{}');
  expect(res.status).toBe(400);
  expect(mockPrisma.paymentEvent.create).not.toHaveBeenCalled();
});

it('rejects a wrong signature with 400', async () => {
  const res = await send(buildApp(), activatedPayload(), 'wrong-secret');
  expect(res.status).toBe(400);
  expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
});

it('activates the subscription on subscription.activated', async () => {
  mockPrisma.paymentEvent.create.mockResolvedValue({ id: 'e1' });
  mockPrisma.subscription.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org1' });
  mockPrisma.plan.findUnique.mockResolvedValue({ tier: 'STARTER', seatLimit: 10 });

  const res = await send(buildApp(), activatedPayload());
  expect(res.status).toBe(200);
  expect(mockPrisma.subscription.update.mock.calls[0][0].data.status).toBe('ACTIVE');
  expect(mockNotify).toHaveBeenCalledWith('org1');
});

it('ignores a duplicate delivery that was already processed', async () => {
  mockPrisma.paymentEvent.create.mockRejectedValue({ code: 'P2002' });
  mockPrisma.paymentEvent.findUnique.mockResolvedValue({ processedAt: new Date() });

  const res = await send(buildApp(), activatedPayload());
  expect(res.status).toBe(200);                        // 200 stops Razorpay retrying
  expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
});

it('re-processes a retry whose first delivery failed mid-processing', async () => {
  mockPrisma.paymentEvent.create.mockRejectedValue({ code: 'P2002' });
  mockPrisma.paymentEvent.findUnique.mockResolvedValue({ processedAt: null });
  mockPrisma.subscription.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org1' });
  mockPrisma.plan.findUnique.mockResolvedValue({ tier: 'STARTER', seatLimit: 10 });

  const res = await send(buildApp(), activatedPayload());
  expect(res.status).toBe(200);
  expect(mockPrisma.subscription.update.mock.calls[0][0].data.status).toBe('ACTIVE');
});

it('does not let a stale event for an old subscription overwrite the current one', async () => {
  mockPrisma.paymentEvent.create.mockResolvedValue({ id: 'e4' });
  // No row carries sub_old any more, and the org's row already holds a newer id.
  mockPrisma.subscription.findFirst.mockResolvedValue(null);

  const res = await send(buildApp(), {
    event: 'subscription.cancelled',
    payload: { subscription: { entity: { id: 'sub_old', notes: { organizationId: 'org1' } } } },
  });
  expect(res.status).toBe(200);
  expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  // The org fallback may only claim a row that has no subscription id yet.
  expect(mockPrisma.subscription.findFirst.mock.calls[1][0].where)
    .toEqual({ organizationId: 'org1', razorpaySubscriptionId: null });
});

it('halts the subscription on subscription.halted', async () => {
  mockPrisma.paymentEvent.create.mockResolvedValue({ id: 'e2' });
  mockPrisma.subscription.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org1' });

  const res = await send(buildApp(), {
    event: 'subscription.halted',
    payload: { subscription: { entity: { id: 'sub_1', notes: { organizationId: 'org1' } } } },
  });
  expect(res.status).toBe(200);
  expect(mockPrisma.subscription.update.mock.calls[0][0].data.status).toBe('HALTED');
});

it('returns 200 for an unknown event without touching the subscription', async () => {
  mockPrisma.paymentEvent.create.mockResolvedValue({ id: 'e3' });
  const res = await send(buildApp(), {
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_1' } } },
  });
  expect(res.status).toBe(200);
  expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
});
