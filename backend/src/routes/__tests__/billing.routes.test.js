const express = require('express');
const request = require('supertest');

const mockPrisma = {
  plan: { findMany: jest.fn(), findUnique: jest.fn() },
  subscription: { findUnique: jest.fn(), update: jest.fn() },
  organization: { findUnique: jest.fn() },
};
const mockRzp = {
  createCustomer: jest.fn(), createSubscription: jest.fn(),
  cancelSubscription: jest.fn(), verifySubscriptionSignature: jest.fn(),
  getKeyId: jest.fn(() => 'rzp_test_key'),
};

jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../services/razorpay.service', () => mockRzp);
jest.mock('../../services/billing.service', () => ({
  getAccessState: jest.fn(async () => ({
    tier: 'TRIAL', status: 'TRIALING', isReadOnly: false,
    daysRemaining: 12, seatsUsed: 3, seatLimit: 10,
  })),
  notifySubscriptionChanged: jest.fn(async () => {}),
}));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

// authenticate is replaced with a stub that injects a fixed admin user.
jest.mock('../../middleware/auth', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B',
                 role: 'ADMIN', organizationId: 'org1' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
  checkPermission: () => (_req, _res, next) => next(),
}));

function buildApp() {
  jest.resetModules();
  const routes = require('../billing.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/v1/billing', routes);
  return app;
}

beforeEach(() => jest.clearAllMocks());

it('GET /plans returns active tiers', async () => {
  mockPrisma.plan.findMany.mockResolvedValue([
    { tier: 'STARTER', name: 'Starter', amount: 3000000, seatLimit: 10 },
  ]);
  const res = await request(buildApp()).get('/api/v1/billing/plans');
  expect(res.status).toBe(200);
  expect(res.body.data[0].amount).toBe(3000000);
});

it('GET /subscription returns derived access state', async () => {
  const res = await request(buildApp()).get('/api/v1/billing/subscription');
  expect(res.status).toBe(200);
  expect(res.body.data.daysRemaining).toBe(12);
});

it('POST /subscribe rejects a tier with no Razorpay plan id', async () => {
  mockPrisma.plan.findUnique.mockResolvedValue({ tier: 'ENTERPRISE', razorpayPlanId: null });
  const res = await request(buildApp()).post('/api/v1/billing/subscribe').send({ tier: 'ENTERPRISE' });
  expect(res.status).toBe(400);
  expect(mockRzp.createSubscription).not.toHaveBeenCalled();
});

it('POST /subscribe creates a subscription and returns the key id', async () => {
  mockPrisma.plan.findUnique.mockResolvedValue({ tier: 'STARTER', razorpayPlanId: 'plan_x', seatLimit: 10, isActive: true });
  mockPrisma.subscription.findUnique.mockResolvedValue({ id: 's1', organizationId: 'org1', razorpayCustomerId: null });
  mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1', name: 'Acme' });
  mockRzp.createCustomer.mockResolvedValue({ id: 'cust_1' });
  mockRzp.createSubscription.mockResolvedValue({ id: 'sub_1', short_url: 'https://rzp.io/i/x', status: 'created' });

  const res = await request(buildApp()).post('/api/v1/billing/subscribe').send({ tier: 'STARTER' });
  expect(res.status).toBe(200);
  expect(res.body.data.subscriptionId).toBe('sub_1');
  expect(res.body.data.keyId).toBe('rzp_test_key');
  expect(mockRzp.createSubscription).toHaveBeenCalledWith(
    expect.objectContaining({ planId: 'plan_x', organizationId: 'org1' }));
});

it('POST /subscribe refuses to open a second subscription for a paying org', async () => {
  mockPrisma.plan.findUnique.mockResolvedValue({ tier: 'STARTER', razorpayPlanId: 'plan_x', seatLimit: 10, isActive: true });
  mockPrisma.subscription.findUnique.mockResolvedValue({
    id: 's1', organizationId: 'org1', status: 'ACTIVE', razorpaySubscriptionId: 'sub_live', cancelledAt: null,
  });

  const res = await request(buildApp()).post('/api/v1/billing/subscribe').send({ tier: 'STARTER' });
  expect(res.status).toBe(409);
  expect(mockRzp.createSubscription).not.toHaveBeenCalled();
});

it('POST /subscribe reopens checkout on the same plan for a PAST_DUE org', async () => {
  mockPrisma.plan.findUnique.mockResolvedValue({ tier: 'STARTER', razorpayPlanId: 'plan_x', seatLimit: 10, isActive: true });
  mockPrisma.subscription.findUnique.mockResolvedValue({
    id: 's1', organizationId: 'org1', status: 'PAST_DUE', razorpaySubscriptionId: 'sub_live', razorpayPlanId: 'plan_x',
  });

  const res = await request(buildApp()).post('/api/v1/billing/subscribe').send({ tier: 'STARTER' });
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({ subscriptionId: 'sub_live', tier: 'STARTER', reused: true });
  expect(mockRzp.createSubscription).not.toHaveBeenCalled();
});

it('POST /subscribe refuses a plan change while PAST_DUE instead of quoting the wrong plan', async () => {
  mockPrisma.plan.findUnique.mockResolvedValue({ tier: 'ENTERPRISE', razorpayPlanId: 'plan_y', seatLimit: 50, isActive: true });
  mockPrisma.subscription.findUnique.mockResolvedValue({
    id: 's1', organizationId: 'org1', status: 'PAST_DUE', razorpaySubscriptionId: 'sub_live', razorpayPlanId: 'plan_x',
  });

  const res = await request(buildApp()).post('/api/v1/billing/subscribe').send({ tier: 'ENTERPRISE' });
  expect(res.status).toBe(409);
  expect(mockRzp.createSubscription).not.toHaveBeenCalled();
});

it('POST /cancel rejects an already-cancelled subscription without calling Razorpay', async () => {
  mockPrisma.subscription.findUnique.mockResolvedValue({
    id: 's1', organizationId: 'org1', status: 'CANCELLED', razorpaySubscriptionId: 'sub_old',
  });

  const res = await request(buildApp()).post('/api/v1/billing/cancel');
  expect(res.status).toBe(409);
  expect(mockRzp.cancelSubscription).not.toHaveBeenCalled();
});

it('POST /verify rejects a bad signature and does not activate', async () => {
  mockRzp.verifySubscriptionSignature.mockReturnValue(false);
  const res = await request(buildApp()).post('/api/v1/billing/verify').send({
    razorpay_payment_id: 'pay_1', razorpay_subscription_id: 'sub_1', razorpay_signature: 'bad',
  });
  expect(res.status).toBe(400);
  expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
});

it('POST /verify activates on a good signature', async () => {
  mockRzp.verifySubscriptionSignature.mockReturnValue(true);
  mockPrisma.subscription.findUnique.mockResolvedValue({ id: 's1', organizationId: 'org1', razorpaySubscriptionId: 'sub_1' });
  mockPrisma.subscription.update.mockResolvedValue({ id: 's1', status: 'ACTIVE' });

  const res = await request(buildApp()).post('/api/v1/billing/verify').send({
    razorpay_payment_id: 'pay_1', razorpay_subscription_id: 'sub_1', razorpay_signature: 'good',
  });
  expect(res.status).toBe(200);
  expect(mockPrisma.subscription.update.mock.calls[0][0].data.status).toBe('ACTIVE');
});

it('POST /verify rejects a subscription id that belongs to another org', async () => {
  mockRzp.verifySubscriptionSignature.mockReturnValue(true);
  mockPrisma.subscription.findUnique.mockResolvedValue({ id: 's1', organizationId: 'org1', razorpaySubscriptionId: 'sub_mine' });

  const res = await request(buildApp()).post('/api/v1/billing/verify').send({
    razorpay_payment_id: 'pay_1', razorpay_subscription_id: 'sub_theirs', razorpay_signature: 'good',
  });
  expect(res.status).toBe(403);
  expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
});
