process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x';

const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const mfa = require('../../services/mfa.service');

const mockUserUpdate = jest.fn(async () => ({}));
const mockSessionCreate = jest.fn(async () => ({}));
let mockUser;
jest.mock('../../config/database', () => ({
  prisma: {
    user: { findUnique: jest.fn(async () => mockUser), update: (...a) => mockUserUpdate(...a) },
    session: { create: (...a) => mockSessionCreate(...a) },
    organization: { findUnique: jest.fn(async () => null) },
  },
}));
jest.mock('../../services/billing.service', () => ({ startTrial: jest.fn() }));
jest.mock('../../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const { login } = require('../auth.controller');

function res() { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); r.cookie = jest.fn(); return r; }
const req = (body) => ({ body, get: () => 'jest', ip: '127.0.0.1' });
const next = (e) => { throw e; };

const { base32 } = mfa.generateSecret('ops@example.com');

beforeAll(async () => {
  mockUser = {
    id: 'u1', email: 'ops@example.com', password: await bcrypt.hash('Secret123', 4),
    status: 'ACTIVE', loginAttempts: 0, lockedUntil: null, role: 'ENGINEER',
    mfaEnabled: true, mfaSecret: mfa.encryptSecret(base32), organizationId: null,
  };
});
beforeEach(() => jest.clearAllMocks());

it('asks for a code without issuing tokens', async () => {
  const r = res();
  await login(req({ email: 'ops@example.com', password: 'Secret123' }), r, next);
  expect(r.json.mock.calls[0][0].data).toEqual({ mfaRequired: true });
  expect(mockSessionCreate).not.toHaveBeenCalled();
});

it('counts a wrong code as a failed attempt', async () => {
  const r = res();
  const wrong = speakeasy.totp({ secret: base32, encoding: 'base32' }) === '000000' ? '111111' : '000000';
  await login(req({ email: 'ops@example.com', password: 'Secret123', mfaCode: wrong }), r, next);
  expect(r.status).toHaveBeenCalledWith(401);
  expect(mockUserUpdate).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { loginAttempts: 1 } });
  expect(mockSessionCreate).not.toHaveBeenCalled();
});

it('issues tokens with a valid code', async () => {
  const r = res();
  const code = speakeasy.totp({ secret: base32, encoding: 'base32' });
  await login(req({ email: 'ops@example.com', password: 'Secret123', mfaCode: code }), r, next);
  expect(r.status).toHaveBeenCalledWith(200);
  expect(r.json.mock.calls[0][0].data.accessToken).toBeTruthy();
});
