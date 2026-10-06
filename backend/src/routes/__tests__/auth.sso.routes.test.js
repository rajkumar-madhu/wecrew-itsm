// Keycloak SSO: full redirect round trip against a fake realm.
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const ISSUER = 'https://kc.example.com/realms/wecrew';
const CLIENT = 'wecrew-itsm';

const mockPrisma = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(async () => ({})) },
  session: { create: jest.fn(async () => ({})) },
  organization: { findUnique: jest.fn(async () => null) },
};
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../config/env', () => ({
  config: {
    frontendUrl: 'https://itsm.example.com',
    keycloak: { url: 'https://kc.example.com', realm: 'wecrew', clientId: 'wecrew-itsm', clientSecret: 's3cret' },
  },
}));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../middleware/rateLimiter', () => ({ authLimiter: (_q, _s, n) => n() }));
jest.mock('../../middleware/billing.middleware', () => ({ enforceSeatLimit: (_q, _s, n) => n() }));
jest.mock('../../services/billing.service', () => ({ startTrial: jest.fn() }));
jest.mock('../../services/passwordReset.service', () => ({}));

const sso = require('../../services/sso.service');

// ── Fake realm ──
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' };
let idClaims;
let tokenRequest;

global.fetch = jest.fn(async (url, init = {}) => {
  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  if (url.endsWith('/.well-known/openid-configuration')) {
    return json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
      token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
      jwks_uri: `${ISSUER}/protocol/openid-connect/certs`,
    });
  }
  if (url.endsWith('/certs')) return json({ keys: [jwk] });
  if (url.endsWith('/token')) {
    tokenRequest = Object.fromEntries(new URLSearchParams(String(init.body)));
    if (tokenRequest.code !== 'good-code') return json({ error: 'invalid_grant' }, 400);
    return json({ id_token: jwt.sign(idClaims, privateKey, { algorithm: 'RS256', keyid: 'k1', expiresIn: 300 }) });
  }
  throw new Error(`unexpected fetch ${url}`);
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', require('../auth.routes'));
  return app;
}

const user = {
  id: 'u1', email: 'asha@acme.com', firstName: 'A', lastName: 'R', role: 'ENGINEER', status: 'ACTIVE',
  organizationId: 'org1', loginAttempts: 0, lockedUntil: null, mfaEnabled: false,
};

/** Run /sso/login and return what the browser would carry back. */
async function startLogin(app) {
  const res = await request(app).get('/api/v1/auth/sso/login');
  const loc = new URL(res.headers.location);
  const cookie = res.headers['set-cookie'].find((c) => c.startsWith('sso_state='));
  return { res, loc, cookie: cookie.split(';')[0], state: loc.searchParams.get('state'), nonce: loc.searchParams.get('nonce') };
}

beforeEach(() => {
  jest.clearAllMocks();
  sso._resetForTests();
  mockPrisma.user.findFirst.mockResolvedValue({ ...user });
  mockPrisma.user.findUnique.mockResolvedValue({ ...user });
});

it('reports SSO as enabled when Keycloak is configured', async () => {
  const res = await request(buildApp()).get('/api/v1/auth/sso/config');
  expect(res.body.data.enabled).toBe(true);
});

it('sends the browser to Keycloak with PKCE, state and nonce', async () => {
  const { res, loc, cookie } = await startLogin(buildApp());
  expect(res.status).toBe(302);
  expect(loc.origin + loc.pathname).toBe(`${ISSUER}/protocol/openid-connect/auth`);
  expect(loc.searchParams.get('client_id')).toBe(CLIENT);
  expect(loc.searchParams.get('redirect_uri')).toBe('https://itsm.example.com/api/v1/auth/sso/callback');
  expect(loc.searchParams.get('code_challenge_method')).toBe('S256');
  expect(loc.searchParams.get('state')).toBeTruthy();
  expect(cookie).toMatch(/^sso_state=/);
  expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
});

it('completes a sign-in and the hand-off works exactly once', async () => {
  const app = buildApp();
  const { cookie, state, nonce } = await startLogin(app);
  idClaims = { iss: ISSUER, aud: CLIENT, sub: 'kc-1', email: 'Asha@Acme.com', email_verified: true, nonce };

  const cb = await request(app).get('/api/v1/auth/sso/callback').query({ code: 'good-code', state }).set('Cookie', cookie);
  expect(cb.status).toBe(302);
  expect(tokenRequest.code_verifier).toBeTruthy();
  expect(mockPrisma.user.findFirst.mock.calls[0][0].where.email).toEqual({ equals: 'asha@acme.com', mode: 'insensitive' });
  const handoff = decodeURIComponent(new URL(cb.headers.location).hash.replace('#handoff=', ''));
  expect(cb.headers.location.startsWith('https://itsm.example.com/sso/callback#handoff=')).toBe(true);

  const ex = await request(app).post('/api/v1/auth/sso/exchange').send({ handoff });
  expect(ex.status).toBe(200);
  expect(ex.body.data.accessToken).toBeTruthy();
  expect((await request(app).post('/api/v1/auth/sso/exchange').send({ handoff })).status).toBe(401);
});

it('asks for the two-factor code when the user has it on', async () => {
  mockPrisma.user.findFirst.mockResolvedValue({ ...user, mfaEnabled: true });
  const app = buildApp();
  const { cookie, state, nonce } = await startLogin(app);
  idClaims = { iss: ISSUER, aud: CLIENT, sub: 'kc-1', email: user.email, email_verified: true, nonce };
  const cb = await request(app).get('/api/v1/auth/sso/callback').query({ code: 'good-code', state }).set('Cookie', cookie);
  expect(cb.headers.location).toMatch(/\/sso\/callback#mfaToken=/);
});

describe('rejections', () => {
  const callback = async ({ claims = {}, code = 'good-code', tamperState = false, noCookie = false } = {}) => {
    const app = buildApp();
    const { cookie, state, nonce } = await startLogin(app);
    idClaims = { iss: ISSUER, aud: CLIENT, sub: 'kc-1', email: user.email, email_verified: true, nonce, ...claims };
    let req = request(app).get('/api/v1/auth/sso/callback').query({ code, state: tamperState ? 'forged' : state });
    if (!noCookie) req = req.set('Cookie', cookie);
    const res = await req;
    return new URL(res.headers.location).searchParams.get('sso_error');
  };

  it('a forged state', async () => expect(await callback({ tamperState: true })).toBe('expired'));
  it('a missing state cookie', async () => expect(await callback({ noCookie: true })).toBe('expired'));
  it('a replayed or wrong nonce', async () => expect(await callback({ claims: { nonce: 'other' } })).toBe('expired'));
  it('a token for another client', async () => expect(await callback({ claims: { aud: 'other-app' } })).toBe('failed'));
  it('a token from another issuer', async () => expect(await callback({ claims: { iss: 'https://evil.example.com' } })).toBe('failed'));
  it('a bad code', async () => expect(await callback({ code: 'bad' })).toBe('failed'));
  it('an unverified email', async () => expect(await callback({ claims: { email_verified: false } })).toBe('unverified'));

  it('someone without a WeCrew account — never auto-created', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    expect(await callback()).toBe('no_account');
  });

  it('a deactivated account looks the same as a missing one', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...user, status: 'INACTIVE' });
    expect(await callback()).toBe('no_account');
  });

  it('a forged hand-off', async () => {
    const res = await request(buildApp()).post('/api/v1/auth/sso/exchange').send({ handoff: 'nope' });
    expect(res.status).toBe(401);
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
  });
});
