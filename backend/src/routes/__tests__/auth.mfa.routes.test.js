// Login with two-factor: password alone never yields a session.
const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const mockPrisma = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(async () => ({})), updateMany: jest.fn() },
  session: { create: jest.fn(async () => ({})), deleteMany: jest.fn(async () => ({})) },
  organization: { findUnique: jest.fn(async () => null) },
};
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../middleware/rateLimiter', () => ({ authLimiter: (_q, _s, n) => n() }));
jest.mock('../../middleware/billing.middleware', () => ({ enforceSeatLimit: (_q, _s, n) => n() }));
jest.mock('../../services/billing.service', () => ({ startTrial: jest.fn() }));
jest.mock('../../services/passwordReset.service', () => ({}));
jest.mock('../../middleware/auth', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'admin1', role: 'ADMIN', organizationId: 'org1' };
    req.tenantWhere = { organizationId: 'org1' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
}));

const mfa = require('../../services/mfa.service');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', require('../auth.routes'));
  return app;
}

const { encrypted, base32 } = mfa.createSecret('a@b.com');
const code = () => speakeasy.totp({ secret: base32, encoding: 'base32' });
let user;

beforeAll(async () => {
  user = {
    id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'ENGINEER', status: 'ACTIVE',
    organizationId: 'org1', password: await bcrypt.hash('Passw0rd!', 4), loginAttempts: 0, lockedUntil: null,
    mfaEnabled: true, mfaSecret: encrypted, mfaLastUsedStep: null,
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockImplementation(async () => ({ ...user }));
  mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
});

it('password step returns a challenge, not a session', async () => {
  const res = await request(buildApp()).post('/api/v1/auth/login').send({ email: 'a@b.com', password: 'Passw0rd!' });
  expect(res.status).toBe(200);
  expect(res.body.data.mfaRequired).toBe(true);
  expect(res.body.data.mfaToken).toBeTruthy();
  expect(res.body.data.accessToken).toBeUndefined();
  expect(mockPrisma.session.create).not.toHaveBeenCalled();
});

it('a correct code completes the sign-in', async () => {
  const app = buildApp();
  const { body } = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.com', password: 'Passw0rd!' });
  const res = await request(app).post('/api/v1/auth/mfa/verify').send({ mfaToken: body.data.mfaToken, code: code() });
  expect(res.status).toBe(200);
  expect(res.body.data.accessToken).toBeTruthy();
  expect(res.body.data.user.mfaEnabled).toBe(true);
  expect(mockPrisma.session.create).toHaveBeenCalled();
});

it('a wrong code is refused and counts toward the lockout', async () => {
  const app = buildApp();
  const { body } = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.com', password: 'Passw0rd!' });
  const wrong = String((Number(code()) + 1) % 1000000).padStart(6, '0');
  const res = await request(app).post('/api/v1/auth/mfa/verify').send({ mfaToken: body.data.mfaToken, code: wrong });
  expect(res.status).toBe(401);
  expect(mockPrisma.session.create).not.toHaveBeenCalled();
  expect(mockPrisma.user.update.mock.calls.at(-1)[0].data.loginAttempts).toBe(1);
});

it('a code that lost the race to another request is refused', async () => {
  const app = buildApp();
  const { body } = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.com', password: 'Passw0rd!' });
  mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
  const res = await request(app).post('/api/v1/auth/mfa/verify').send({ mfaToken: body.data.mfaToken, code: code() });
  expect(res.status).toBe(401);
  expect(mockPrisma.session.create).not.toHaveBeenCalled();
});

it('a forged or missing challenge is refused', async () => {
  const res = await request(buildApp()).post('/api/v1/auth/mfa/verify').send({ mfaToken: 'forged', code: code() });
  expect(res.status).toBe(401);
});

it('users without two-factor still get a session from the password alone', async () => {
  mockPrisma.user.findUnique.mockImplementation(async () => ({ ...user, mfaEnabled: false, mfaSecret: null }));
  const res = await request(buildApp()).post('/api/v1/auth/login').send({ email: 'a@b.com', password: 'Passw0rd!' });
  expect(res.status).toBe(200);
  expect(res.body.data.accessToken).toBeTruthy();
});

describe('enrolment', () => {
  it('setup stores an encrypted secret; enable needs a valid code', async () => {
    mockPrisma.user.findUnique.mockImplementation(async () => ({ ...user, mfaEnabled: false, mfaSecret: null }));
    const setup = await request(buildApp()).post('/api/v1/auth/mfa/setup');
    expect(setup.status).toBe(200);
    const stored = mockPrisma.user.update.mock.calls[0][0].data.mfaSecret;
    expect(stored).not.toContain(setup.body.data.secret);

    mockPrisma.user.findUnique.mockImplementation(async () => ({ ...user, mfaEnabled: false, mfaSecret: stored }));
    const bad = await request(buildApp()).post('/api/v1/auth/mfa/enable').send({ code: '000000' });
    expect(bad.status).toBe(400);
    const good = await request(buildApp()).post('/api/v1/auth/mfa/enable').send({
      code: speakeasy.totp({ secret: setup.body.data.secret, encoding: 'base32' }),
    });
    expect(good.status).toBe(200);
    expect(mockPrisma.user.update.mock.calls.at(-1)[0].data.mfaEnabled).toBe(true);
  });

  it('disable needs the password as well as a code', async () => {
    const res = await request(buildApp()).post('/api/v1/auth/mfa/disable').send({ password: 'wrong', code: code() });
    expect(res.status).toBe(400);
    const ok = await request(buildApp()).post('/api/v1/auth/mfa/disable').send({ password: 'Passw0rd!', code: code() });
    expect(ok.status).toBe(200);
    expect(mockPrisma.user.update.mock.calls.at(-1)[0].data).toMatchObject({ mfaEnabled: false, mfaSecret: null });
  });

  it('an admin can reset only users in their own org', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const other = await request(buildApp()).delete('/api/v1/auth/users/7d3f9a52-0f4e-4a43-9a51-2b6b8c1d0e11/mfa');
    expect(other.status).toBe(404);
    expect(mockPrisma.user.findFirst.mock.calls[0][0].where.organizationId).toBe('org1');

    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const ok = await request(buildApp()).delete('/api/v1/auth/users/7d3f9a52-0f4e-4a43-9a51-2b6b8c1d0e11/mfa');
    expect(ok.status).toBe(200);
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
});
