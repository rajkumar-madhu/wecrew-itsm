// ═══════════════════════════════════════════════════════════
// SSO controller: callback account rules and admin config validation.
// The OIDC protocol pieces are mocked here (covered in sso.service.test.js).
// ═══════════════════════════════════════════════════════════

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x';
process.env.FRONTEND_URL = 'https://itsm.example';

const mockPrisma = {
  ssoConfig: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
};
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('../../services/billing.service', () => ({ getAccessState: jest.fn(async () => ({ seatLimit: null, seatsUsed: 0 })), startTrial: jest.fn() }));
const mockStartSession = jest.fn(async () => ({}));
jest.mock('../auth.controller', () => ({ startSession: (...a) => mockStartSession(...a) }));
jest.mock('../../services/sso.service', () => {
  const actual = jest.requireActual('../../services/sso.service');
  return {
    ...actual,
    discover: jest.fn(async () => ({ authorization_endpoint: 'https://idp.acme.io/authorize' })),
    exchangeCode: jest.fn(async () => ({ id_token: 'tok' })),
    verifyIdToken: jest.fn(),
  };
});

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sso = require('../../services/sso.service');
const { getAccessState } = require('../../services/billing.service');
const { encryptSecret } = require('../../services/mfa.service');
const ctrl = require('../sso.controller');

const CFG = {
  id: 'c1', organizationId: 'acme', enabled: true, enforce: false, issuer: 'https://idp.acme.io',
  clientId: 'cid', clientSecret: encryptSecret('secret'), domains: ['acme.io'], defaultRole: 'REQUESTER', autoProvision: true,
};

function res() {
  const r = {};
  r.status = jest.fn(() => r); r.json = jest.fn(() => r);
  r.cookie = jest.fn(); r.clearCookie = jest.fn(); r.redirect = jest.fn();
  return r;
}
const stateKey = () => crypto.createHash('sha256').update(`sso-state:${process.env.JWT_SECRET}`).digest();
function callbackReq({ state = 's1', ticket } = {}) {
  const cookie = ticket ?? jwt.sign({ o: 'acme', s: 's1', n: 'n1', v: 'v1' }, stateKey(), { expiresIn: 600 });
  return { query: { code: 'code1', state }, cookies: { argus_sso: cookie }, get: () => 'jest', ip: '127.0.0.1' };
}
const redirectedTo = (r) => r.redirect.mock.calls[0][1];

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.ssoConfig.findUnique.mockResolvedValue(CFG);
  mockPrisma.ssoConfig.findFirst.mockResolvedValue(null);
  mockPrisma.user.findFirst.mockResolvedValue(null);
  sso.verifyIdToken.mockResolvedValue({ sub: 'sub-1', email: 'Jo@acme.io', email_verified: true, given_name: 'Jo' });
});

describe('start', () => {
  it('sets a state cookie and redirects to the IdP for a configured domain', async () => {
    mockPrisma.ssoConfig.findFirst.mockResolvedValue(CFG);
    const r = res();
    await ctrl.start({ query: { email: 'jo@acme.io' } }, r);
    expect(r.cookie).toHaveBeenCalledWith('argus_sso', expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: 'lax' }));
    expect(redirectedTo(r)).toMatch(/^https:\/\/idp\.acme\.io\/authorize\?/);
    expect(new URL(redirectedTo(r)).searchParams.get('redirect_uri')).toBe('https://itsm.example/api/v1/auth/sso/callback');
  });
  it('sends an unknown domain back to the login page', async () => {
    const r = res();
    await ctrl.start({ query: { email: 'jo@other.io' } }, r);
    expect(redirectedTo(r)).toBe('https://itsm.example/login?sso_error=not_configured');
  });
});

describe('callback', () => {
  it('signs in an existing member of the organization', async () => {
    const user = { id: 'u1', email: 'jo@acme.io', organizationId: 'acme', status: 'ACTIVE', isPlatformAdmin: false, ssoId: null };
    mockPrisma.user.findUnique.mockResolvedValue(user);
    const r = res();
    await ctrl.callback(callbackReq(), r);
    expect(mockStartSession).toHaveBeenCalledWith(expect.anything(), r, user, { ssoProvider: 'oidc', ssoId: 'sub-1' });
    expect(redirectedTo(r)).toBe('https://itsm.example/sso/callback');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'jo@acme.io' } });
  });

  it('rejects a state that does not match the cookie', async () => {
    const r = res();
    await ctrl.callback(callbackReq({ state: 'forged' }), r);
    expect(redirectedTo(r)).toMatch(/sso_error=state_mismatch/);
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it('rejects a missing or tampered state cookie', async () => {
    const r = res();
    await ctrl.callback(callbackReq({ ticket: jwt.sign({ o: 'other', s: 's1' }, 'wrong-key') }), r);
    expect(redirectedTo(r)).toMatch(/sso_error=expired/);
  });

  it('never signs in a user of another organization', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u9', organizationId: 'victim', status: 'ACTIVE' });
    const r = res();
    await ctrl.callback(callbackReq(), r);
    expect(redirectedTo(r)).toMatch(/sso_error=wrong_organization/);
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it('never signs in platform staff through an organization IdP', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'p', organizationId: 'acme', status: 'ACTIVE', isPlatformAdmin: true });
    const r = res();
    await ctrl.callback(callbackReq(), r);
    expect(redirectedTo(r)).toMatch(/sso_error=use_password/);
  });

  it('refuses an email outside the configured domains or one the IdP has not verified', async () => {
    sso.verifyIdToken.mockResolvedValueOnce({ sub: 's', email: 'jo@elsewhere.io' });
    let r = res();
    await ctrl.callback(callbackReq(), r);
    expect(redirectedTo(r)).toMatch(/sso_error=domain_not_allowed/);

    sso.verifyIdToken.mockResolvedValueOnce({ sub: 's', email: 'jo@acme.io', email_verified: false });
    r = res();
    await ctrl.callback(callbackReq(), r);
    expect(redirectedTo(r)).toMatch(/sso_error=email_unverified/);
  });

  it('refuses when the IdP subject changed for an existing account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', organizationId: 'acme', status: 'ACTIVE', ssoId: 'someone-else' });
    const r = res();
    await ctrl.callback(callbackReq(), r);
    expect(redirectedTo(r)).toMatch(/sso_error=identity_mismatch/);
  });

  it('provisions a new user with the default role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockImplementation(async ({ data }) => ({ id: 'new', ...data }));
    const r = res();
    await ctrl.callback(callbackReq(), r);
    expect(mockPrisma.user.create.mock.calls[0][0].data).toMatchObject({
      email: 'jo@acme.io', firstName: 'Jo', role: 'REQUESTER', organizationId: 'acme', ssoProvider: 'oidc', ssoId: 'sub-1',
    });
    expect(redirectedTo(r)).toBe('https://itsm.example/sso/callback');
  });

  it('does not provision past the seat limit or when provisioning is off', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    getAccessState.mockResolvedValueOnce({ seatLimit: 5, seatsUsed: 5 });
    let r = res();
    await ctrl.callback(callbackReq(), r);
    expect(redirectedTo(r)).toMatch(/sso_error=seat_limit/);

    mockPrisma.ssoConfig.findUnique.mockResolvedValue({ ...CFG, autoProvision: false });
    r = res();
    await ctrl.callback(callbackReq(), r);
    expect(redirectedTo(r)).toMatch(/sso_error=not_provisioned/);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('passes on the IdP error', async () => {
    const r = res();
    await ctrl.callback({ query: { error: 'access_denied' }, cookies: {} }, r);
    expect(redirectedTo(r)).toMatch(/sso_error=idp_error/);
  });
});

describe('admin config', () => {
  const adminReq = (body) => ({ body, query: {}, headers: {}, user: { id: 'a', email: 'admin@acme.io', role: 'ADMIN', organizationId: 'acme' } });
  const base = { issuer: 'https://idp.acme.io/', clientId: 'cid', clientSecret: 's', domains: ['acme.io'], enabled: false };
  const next = (e) => { throw e; };

  beforeEach(() => {
    mockPrisma.ssoConfig.findUnique.mockResolvedValue(null);
    mockPrisma.ssoConfig.create.mockImplementation(async ({ data }) => data);
  });

  it('saves a new config with the secret encrypted and never returns it', async () => {
    const r = res();
    await ctrl.putConfig(adminReq(base), r, next);
    const data = mockPrisma.ssoConfig.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ organizationId: 'acme', issuer: 'https://idp.acme.io', domains: ['acme.io'], defaultRole: 'REQUESTER' });
    expect(data.clientSecret).toMatch(/^v1:/);
    const out = r.json.mock.calls[0][0].data;
    expect(out.hasClientSecret).toBe(true);
    expect(out).not.toHaveProperty('clientSecret');
  });

  it('refuses Admin as the default role for new SSO users', async () => {
    const r = res();
    await ctrl.putConfig(adminReq({ ...base, defaultRole: 'ADMIN' }), r, next);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('refuses a domain another organization already routes or uses', async () => {
    mockPrisma.ssoConfig.findFirst.mockResolvedValueOnce({ id: 'other' });
    let r = res();
    await ctrl.putConfig(adminReq(base), r, next);
    expect(r.status).toHaveBeenCalledWith(409);

    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'foreign' });
    r = res();
    await ctrl.putConfig(adminReq(base), r, next);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(mockPrisma.ssoConfig.create).not.toHaveBeenCalled();
  });

  it('checks the issuer before enabling, and only enforces when enabled', async () => {
    sso.discover.mockRejectedValueOnce(new sso.SsoError('unreachable', 'Could not read'));
    let r = res();
    await ctrl.putConfig(adminReq({ ...base, enabled: true }), r, next);
    expect(r.status).toHaveBeenCalledWith(400);

    r = res();
    await ctrl.putConfig(adminReq({ ...base, enabled: false, enforce: true }), r, next);
    expect(mockPrisma.ssoConfig.create.mock.calls[0][0].data.enforce).toBe(false);
  });

  it('needs a client secret on first save', async () => {
    const r = res();
    await ctrl.putConfig(adminReq({ ...base, clientSecret: '' }), r, next);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});
