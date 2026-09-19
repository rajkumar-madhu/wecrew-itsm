// ═══════════════════════════════════════════════════════════
// Tenant isolation — who may leave their own organization.
//
// Self-service signup makes every registrant an ADMIN of their own org, so
// "role === ADMIN" can no longer mean "may see every tenant". These tests
// pin the rule to isPlatformAdmin, in both places tenant scope is decided:
// the inline block in authenticate() and the tenantContext middleware.
// ═══════════════════════════════════════════════════════════

const mockFindUser = jest.fn();
jest.mock('../../config/database', () => ({ prisma: { user: { findUnique: (...a) => mockFindUser(...a) } } }));
const mockVerify = jest.fn(() => ({ id: 'u1' }));
jest.mock('../../utils/jwt', () => ({ verifyAccessToken: (...a) => mockVerify(...a) }));

const { tenantContext, getCreateOrgId, NO_TENANT } = require('../tenant');
const { authenticate, requirePlatformAdmin } = require('../auth');

const PLATFORM = { id: 'p', role: 'ADMIN', isPlatformAdmin: true, organizationId: 'wecrew', status: 'ACTIVE' };
const ORG_ADMIN = { id: 'a', role: 'ADMIN', isPlatformAdmin: false, organizationId: 'acme', status: 'ACTIVE' };
const VIEWER_NO_ORG = { id: 'v', role: 'VIEWER', isPlatformAdmin: false, organizationId: null, status: 'ACTIVE' };

function req(user, { header, body } = {}) {
  return {
    user, query: {}, body: body || {},
    headers: { authorization: 'Bearer t', ...(header ? { 'x-organization-id': header } : {}) },
  };
}
function res() {
  const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r;
}

describe('tenantContext', () => {
  it('lets a platform admin switch org by header, or see all without one', () => {
    const a = req(PLATFORM, { header: 'victim' }); tenantContext(a, res(), () => {});
    expect(a.tenantWhere).toEqual({ organizationId: 'victim' });
    const b = req(PLATFORM); tenantContext(b, res(), () => {});
    expect(b.tenantWhere).toEqual({});
  });

  it('ignores the org header for an org ADMIN', () => {
    const r = req(ORG_ADMIN, { header: 'victim' }); tenantContext(r, res(), () => {});
    expect(r.organizationId).toBe('acme');
    expect(r.tenantWhere).toEqual({ organizationId: 'acme' });
  });

  it('scopes a user with no organization to nothing, never to everything', () => {
    const r = req(VIEWER_NO_ORG); tenantContext(r, res(), () => {});
    expect(r.organizationId).toBeNull();
    expect(r.tenantWhere).toBe(NO_TENANT);
  });
});

describe('getCreateOrgId', () => {
  it('lets only a platform admin create records in another org', () => {
    expect(getCreateOrgId(req(PLATFORM, { body: { organizationId: 'victim' } }))).toBe('victim');
    expect(getCreateOrgId(req(ORG_ADMIN, { body: { organizationId: 'victim' } }))).toBe('acme');
    expect(getCreateOrgId(req(ORG_ADMIN, { header: 'victim' }))).toBe('acme');
  });
});

describe('authenticate (inline tenant scope)', () => {
  async function run(user, opts) {
    mockFindUser.mockResolvedValue(user);
    const r = req(undefined, opts); const next = jest.fn();
    await authenticate(r, res(), next);
    expect(next).toHaveBeenCalled();
    return r;
  }

  it('keeps an org ADMIN in their own org despite the header', async () => {
    const r = await run(ORG_ADMIN, { header: 'victim' });
    expect(r.tenantWhere).toEqual({ organizationId: 'acme' });
  });

  it('lets a platform admin with an org switch by header', async () => {
    const r = await run(PLATFORM, { header: 'victim' });
    expect(r.tenantWhere).toEqual({ organizationId: 'victim' });
  });

  it('scopes a no-org user to nothing', async () => {
    const r = await run(VIEWER_NO_ORG, { header: 'victim' });
    expect(r.tenantWhere).toBe(NO_TENANT);
  });

  it('loads isPlatformAdmin with the user', async () => {
    await run(ORG_ADMIN);
    expect(mockFindUser.mock.calls[0][0].select.isPlatformAdmin).toBe(true);
  });
});

describe('requirePlatformAdmin', () => {
  it('rejects an org ADMIN and admits a platform admin', () => {
    const r1 = res(); const n1 = jest.fn();
    requirePlatformAdmin(req(ORG_ADMIN), r1, n1);
    expect(r1.status).toHaveBeenCalledWith(403);
    expect(n1).not.toHaveBeenCalled();

    const n2 = jest.fn();
    requirePlatformAdmin(req(PLATFORM), res(), n2);
    expect(n2).toHaveBeenCalled();
  });
});

describe('record-level helpers', () => {
  const { inScope, scopedWhere, stripTenantFields } = require('../tenant');
  const scoped = (tw) => ({ tenantWhere: tw });

  it('inScope: platform-all sees any org; org scope only its own; nothing-scope sees none', () => {
    expect(inScope(scoped({}), { organizationId: 'x' })).toBe(true);
    expect(inScope(scoped({ organizationId: 'acme' }), { organizationId: 'acme' })).toBe(true);
    expect(inScope(scoped({ organizationId: 'acme' }), { organizationId: 'victim' })).toBe(false);
    expect(inScope(scoped(NO_TENANT), { organizationId: null })).toBe(false);
    expect(inScope({}, { organizationId: 'acme' })).toBe(false);
    expect(inScope(scoped({}), null)).toBe(false);
  });

  it('scopedWhere never degrades to an empty filter when tenant context is missing', () => {
    expect(scopedWhere({})).toBe(NO_TENANT);
  });

  it('stripTenantFields removes id and organizationId only', () => {
    expect(stripTenantFields({ id: 'i', organizationId: 'o', name: 'n' })).toEqual({ name: 'n' });
  });
});

describe('authenticate: tokens older than the last password change', () => {
  it('rejects a token issued before passwordChangedAt and accepts a newer one', async () => {
    const changed = new Date('2026-09-19T12:00:00Z');
    mockFindUser.mockResolvedValue({ ...ORG_ADMIN, passwordChangedAt: changed });

    mockVerify.mockReturnValueOnce({ id: 'a', iat: Math.floor(changed.getTime() / 1000) - 60 });
    const r1 = res(); const n1 = jest.fn();
    await authenticate(req(undefined), r1, n1);
    expect(r1.status).toHaveBeenCalledWith(401);
    expect(n1).not.toHaveBeenCalled();

    mockVerify.mockReturnValueOnce({ id: 'a', iat: Math.floor(changed.getTime() / 1000) + 5 });
    const r2 = req(undefined); const n2 = jest.fn();
    await authenticate(r2, res(), n2);
    expect(n2).toHaveBeenCalled();
    expect(r2.user.passwordChangedAt).toBeUndefined(); // not leaked onto req.user
  });
});
