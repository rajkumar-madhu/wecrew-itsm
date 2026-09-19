// ═══════════════════════════════════════════════════════════
// Socket tenant isolation: room admission and event routing.
// ═══════════════════════════════════════════════════════════

const mockPrisma = {
  team: { findUnique: jest.fn() },
  incident: { findUnique: jest.fn() },
  alert: { findUnique: jest.fn() },
  voiceCallLog: { findUnique: jest.fn() },
};
jest.mock('../database', () => ({ prisma: mockPrisma }));

const { emitToAll, _internal } = require('../socket');
const { canJoinTeam, canJoinIncident, resolveEventOrg, setIO } = _internal;

const ORG_ENGINEER = { id: 'u1', role: 'ENGINEER', organizationId: 'acme', isPlatformAdmin: false };
const ORG_ADMIN = { id: 'u2', role: 'ADMIN', organizationId: 'acme', isPlatformAdmin: false };
const PLATFORM = { id: 'p', role: 'ADMIN', organizationId: 'wecrew', isPlatformAdmin: true };

beforeEach(() => jest.clearAllMocks());

describe('canJoinTeam', () => {
  it('refuses another org\'s team even for an org ADMIN', async () => {
    mockPrisma.team.findUnique.mockResolvedValue({ organizationId: 'victim', members: [] });
    expect(await canJoinTeam(ORG_ADMIN, 't1')).toBe(false);
  });
  it('admits a platform admin to any team', async () => {
    mockPrisma.team.findUnique.mockResolvedValue({ organizationId: 'victim', members: [] });
    expect(await canJoinTeam(PLATFORM, 't1')).toBe(true);
  });
  it('needs membership for a non-manager in the same org', async () => {
    mockPrisma.team.findUnique.mockResolvedValue({ organizationId: 'acme', members: [] });
    expect(await canJoinTeam(ORG_ENGINEER, 't1')).toBe(false);
    mockPrisma.team.findUnique.mockResolvedValue({ organizationId: 'acme', members: [{ userId: 'u1' }] });
    expect(await canJoinTeam(ORG_ENGINEER, 't1')).toBe(true);
  });
  it('rejects non-string ids without querying', async () => {
    expect(await canJoinTeam(ORG_ADMIN, { $ne: null })).toBe(false);
    expect(mockPrisma.team.findUnique).not.toHaveBeenCalled();
  });
});

describe('canJoinIncident', () => {
  it('only admits incidents of the user\'s org', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({ organizationId: 'victim' });
    expect(await canJoinIncident(ORG_ENGINEER, 'i1')).toBe(false);
    mockPrisma.incident.findUnique.mockResolvedValue({ organizationId: 'acme' });
    expect(await canJoinIncident(ORG_ENGINEER, 'i1')).toBe(true);
  });
});

describe('emitToAll routing', () => {
  function fakeIO() {
    const rooms = [];
    const chain = { to: jest.fn((r) => { rooms.push(r); return chain; }), emit: jest.fn() };
    return { io: { to: chain.to, emit: jest.fn() }, chain, rooms };
  }

  it('emits an incident event to its org and platform, never globally', async () => {
    const { io, chain, rooms } = fakeIO(); setIO(io);
    mockPrisma.incident.findUnique.mockResolvedValue({ organizationId: 'acme' });
    emitToAll('incident:created', { id: 'i1', number: 'INC1' });
    await new Promise((r) => setImmediate(r));
    expect(rooms).toEqual(['platform', 'org:acme']);
    expect(chain.emit).toHaveBeenCalledWith('incident:created', { id: 'i1', number: 'INC1' });
    expect(io.emit).not.toHaveBeenCalled();
  });

  it('sends an unresolvable event to platform staff only', async () => {
    const { io, rooms } = fakeIO(); setIO(io);
    mockPrisma.alert.findUnique.mockResolvedValue(null);
    emitToAll('alert:fired', { id: 'gone' });
    await new Promise((r) => setImmediate(r));
    expect(rooms).toEqual(['platform']);
  });

  it('resolves voice events via the call log and honours an explicit organizationId', async () => {
    mockPrisma.voiceCallLog.findUnique.mockResolvedValue({ organizationId: 'acme' });
    expect(await resolveEventOrg('voice:call-completed', { callId: 'c1' })).toBe('acme');
    expect(await resolveEventOrg('pipeline:execution', { organizationId: 'x' })).toBe('x');
  });
});
