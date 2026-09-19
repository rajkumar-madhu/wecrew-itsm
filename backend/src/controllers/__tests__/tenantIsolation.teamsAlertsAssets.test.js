// ═══════════════════════════════════════════════════════════
// Cross-tenant (IDOR) guards — teams, alerts, notifications, assets.
//
// Callers are an org-scoped user in 'acme' (tenantWhere as authenticate()
// resolves it). Every lookup of another org's record must read as 404 and
// never reach the write.
// ═══════════════════════════════════════════════════════════

const mockPrisma = {
  team: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  teamMember: { create: jest.fn(), deleteMany: jest.fn() },
  user: { findFirst: jest.fn() },
  escalationPolicy: { findFirst: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
  onCallSchedule: { create: jest.fn() },
  alert: { findFirst: jest.fn(), update: jest.fn() },
  notification: { findFirst: jest.fn(), update: jest.fn() },
  configurationItem: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
  activity: { create: jest.fn() },
};
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../config/socket', () => ({ emitToAll: jest.fn() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../utils/cmdbResolver', () => ({ resolveInstanceToConfigItem: jest.fn() }));

const team = require('../team.controller');
const alert = require('../alert.controller');
const notification = require('../notification.controller');
const asset = require('../asset.controller');

const ACME = { organizationId: 'acme' };
function req({ params = {}, body = {} } = {}) {
  return {
    params, body, query: {},
    user: { id: 'u-acme', role: 'ADMIN', isPlatformAdmin: false, organizationId: 'acme' },
    organizationId: 'acme', tenantWhere: ACME, headers: {},
  };
}
function res() {
  const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r;
}
const next = (err) => { if (err) throw err; };

beforeEach(() => jest.resetAllMocks());

describe('teams', () => {
  it('PATCH /teams/:id on another org\'s team → 404, no update', async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);
    const r = res();
    await team.updateTeam(req({ params: { id: 'victim-team' }, body: { name: 'pwned' } }), r, next);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
    expect(mockPrisma.team.findFirst.mock.calls[0][0].where).toEqual({ organizationId: 'acme', id: 'victim-team' });
  });

  it('PATCH /teams/:id cannot move the team to another org or write relations', async () => {
    mockPrisma.team.findFirst.mockResolvedValue({ id: 't1', organizationId: 'acme', managerId: null });
    mockPrisma.team.update.mockResolvedValue({ id: 't1' });
    await team.updateTeam(req({ params: { id: 't1' }, body: {
      name: 'ok', organizationId: 'victim', members: { create: { userId: 'x' } },
    } }), res(), next);
    expect(mockPrisma.team.update.mock.calls[0][0].data).toEqual({ name: 'ok' });
  });

  it('POST /teams/:id/members rejects a user from another org', async () => {
    mockPrisma.team.findFirst.mockResolvedValue({ id: 't1', organizationId: 'acme' });
    mockPrisma.user.findFirst.mockResolvedValue(null); // not in acme
    const r = res();
    await team.addMember(req({ params: { id: 't1' }, body: { userId: 'victim-user' } }), r, next);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.teamMember.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.findFirst.mock.calls[0][0].where).toEqual({ id: 'victim-user', organizationId: 'acme' });
  });

  it('POST /teams/:id/members on another org\'s team → 404', async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);
    const r = res();
    await team.addMember(req({ params: { id: 'victim-team' }, body: { userId: 'u-acme' } }), r, next);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.teamMember.create).not.toHaveBeenCalled();
  });

  it('DELETE escalation policy that is not on the :id team → 404, no delete', async () => {
    mockPrisma.team.findFirst.mockResolvedValue({ id: 't1', organizationId: 'acme' });
    mockPrisma.escalationPolicy.findFirst.mockResolvedValue(null); // victim's policy id
    const r = res();
    await team.deleteEscalationPolicy(req({ params: { id: 't1', policyId: 'victim-policy' } }), r, next);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.escalationPolicy.delete).not.toHaveBeenCalled();
  });

  it('POST /teams/:id/on-call rejects a responder from another org', async () => {
    mockPrisma.team.findFirst.mockResolvedValue({ id: 't1', organizationId: 'acme' });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const r = res();
    await team.createOnCallSchedule(req({ params: { id: 't1' }, body: {
      userId: 'victim-user', startTime: '2026-01-01', endTime: '2026-01-02',
    } }), r, next);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.onCallSchedule.create).not.toHaveBeenCalled();
  });
});

describe('alerts', () => {
  it('POST /alerts/:id/acknowledge on another org\'s alert → 404, no update', async () => {
    mockPrisma.alert.findFirst.mockResolvedValue(null);
    const r = res();
    await alert.acknowledgeAlert(req({ params: { id: 'victim-alert' } }), r, next);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.alert.update).not.toHaveBeenCalled();
  });

  it('POST /alerts/:id/silence on another org\'s alert → 404, no update', async () => {
    mockPrisma.alert.findFirst.mockResolvedValue(null);
    const r = res();
    await alert.silenceAlert(req({ params: { id: 'victim-alert' }, body: { duration: 60 } }), r, next);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.alert.update).not.toHaveBeenCalled();
  });
});

describe('notifications', () => {
  it('PATCH /notifications/:id/read on someone else\'s notification → 404', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    const r = res();
    await notification.markAsRead(req({ params: { id: 'their-note' } }), r, next);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    expect(mockPrisma.notification.findFirst.mock.calls[0][0].where).toEqual({ id: 'their-note', userId: 'u-acme' });
  });
});

describe('assets', () => {
  it('PATCH /assets/:id cannot set organizationId', async () => {
    mockPrisma.configurationItem.findUnique.mockResolvedValue({ id: 'ci1', organizationId: 'acme', ownerId: null, supportGroupId: null });
    mockPrisma.configurationItem.update.mockResolvedValue({ id: 'ci1', name: 'db' });
    await asset.updateAsset(req({ params: { id: 'ci1' }, body: { name: 'db', organizationId: 'victim', id: 'other' } }), res(), next);
    const data = mockPrisma.configurationItem.update.mock.calls[0][0].data;
    expect(data).toEqual({ name: 'db' });
  });

  it('PATCH /assets/:id rejects an owner from another org', async () => {
    mockPrisma.configurationItem.findUnique.mockResolvedValue({ id: 'ci1', organizationId: 'acme', ownerId: null, supportGroupId: null });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const r = res();
    await asset.updateAsset(req({ params: { id: 'ci1' }, body: { ownerId: 'victim-user' } }), r, next);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.configurationItem.update).not.toHaveBeenCalled();
  });

  it('DELETE /assets/:id on another org\'s CI → 404, no delete', async () => {
    mockPrisma.configurationItem.findFirst.mockResolvedValue(null);
    const r = res();
    await asset.deleteAsset(req({ params: { id: 'victim-ci' } }), r, next);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.configurationItem.delete).not.toHaveBeenCalled();
  });
});
