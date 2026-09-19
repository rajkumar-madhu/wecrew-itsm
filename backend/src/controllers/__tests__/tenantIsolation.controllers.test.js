// ═══════════════════════════════════════════════════════════
// Cross-tenant (IDOR) regression tests — incidents, reports, problems, changes.
//
// The fake Prisma below honours the tenant filter the handlers build
// (`{ ...scopedWhere(req), id }`), so a handler that forgets the filter finds
// the victim's row and the test fails. Caller: an org ADMIN of "acme".
// ═══════════════════════════════════════════════════════════

const mockRows = {
  incident: [
    { id: 'inc-own', organizationId: 'acme', number: 'INC1', priority: 'P3', state: 'NEW', impact: 'INDIVIDUAL', urgency: 'LOW', createdAt: new Date(), createdBy: { firstName: 'C', lastName: 'D' } },
    { id: 'inc-victim', organizationId: 'victim', number: 'INC2', priority: 'P1', state: 'NEW', impact: 'INDIVIDUAL', urgency: 'LOW', createdAt: new Date(), createdBy: { firstName: 'C', lastName: 'D' } },
  ],
  change: [
    { id: 'chg-own', organizationId: 'acme', state: 'NEW' },
    { id: 'chg-victim', organizationId: 'victim', state: 'NEW' },
  ],
  problem: [{ id: 'prb-victim', organizationId: 'victim', state: 'NEW' }],
  user: [{ id: 'user-victim', organizationId: 'victim' }, { id: 'user-own', organizationId: 'acme' }],
  team: [], configurationItem: [],
};

function mockMatches(row, where = {}) {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && Array.isArray(v.in)) return v.in.includes(row[k]);
    return row[k] === v;
  });
}
function mockModel(name) {
  return {
    findFirst: jest.fn(async ({ where }) => mockRows[name].find((r) => mockMatches(r, where)) || null),
    findUnique: jest.fn(async ({ where }) => mockRows[name].find((r) => r.id === where.id) || null),
    findMany: jest.fn(async ({ where }) => mockRows[name].filter((r) => mockMatches(r, where))),
    update: jest.fn(async ({ where, data }) => ({ ...mockRows[name].find((r) => r.id === where.id), ...data })),
    create: jest.fn(async ({ data }) => ({ id: 'new', ...data })),
  };
}

const mockPrisma = {
  incident: mockModel('incident'), change: mockModel('change'), problem: mockModel('problem'),
  user: mockModel('user'), team: mockModel('team'), configurationItem: mockModel('configurationItem'),
  activity: { create: jest.fn(async () => ({})) },
  workNote: { create: jest.fn(async ({ data }) => ({ id: 'note', ...data })) },
  incidentChange: { create: jest.fn(async ({ data }) => data) },
  incidentProblem: { create: jest.fn(async ({ data }) => data) },
};

jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../config/redis', () => ({ deletePattern: jest.fn(async () => {}) }));
jest.mock('../../config/socket', () => ({
  emitToAll: jest.fn(), emitToTeam: jest.fn(), emitToUser: jest.fn(), emitToIncident: jest.fn(),
}));
jest.mock('../../services/eventEmitter', () => ({ emit: jest.fn() }));
jest.mock('../../services/emailService', () => ({ sendEmail: jest.fn(), templates: {} }));
jest.mock('../../services/aiService', () => ({ ollamaGenerate: jest.fn() }));
jest.mock('./../alert.controller', () => ({ ALERT_KB: {}, getAlertKB: jest.fn() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../utils/helpers', () => ({
  ...jest.requireActual('../../utils/helpers'),
  generateIncidentNumber: jest.fn(async () => 'INC9'),
}));

const incidentCtrl = require('../incident.controller');
const reportCtrl = require('../incident-report.controller');
const problemCtrl = require('../problem.controller');
const changeCtrl = require('../change.controller');

const ACME_ADMIN = { id: 'u1', email: 'a@acme.test', firstName: 'A', lastName: 'B', role: 'ADMIN', isPlatformAdmin: false, organizationId: 'acme' };

function mockReq({ params = {}, body = {}, query = {} } = {}) {
  return { params, body, query, headers: {}, user: ACME_ADMIN, organizationId: 'acme', tenantWhere: { organizationId: 'acme' } };
}
function mockRes() {
  const r = {};
  r.status = jest.fn(() => r); r.json = jest.fn(() => r); r.setHeader = jest.fn(); r.send = jest.fn();
  return r;
}
async function call(handler, req) {
  const res = mockRes(); const next = jest.fn();
  await handler(req, res, next);
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return res;
}
const statusOf = (res) => (res.status.mock.calls.length ? res.status.mock.calls[0][0] : 200);

beforeEach(() => jest.clearAllMocks());

describe('incident report', () => {
  it('returns 404 for another org\'s incident and writes no Activity onto it', async () => {
    const res = await call(reportCtrl.generateIncidentReport, mockReq({ params: { id: 'inc-victim' }, query: { format: 'json' } }));
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.activity.create).not.toHaveBeenCalled();
  });

  it('bulk report silently drops ids from other orgs', async () => {
    const res = await call(reportCtrl.generateBulkReport, mockReq({ body: { incidentIds: ['inc-own', 'inc-victim'], format: 'json' } }));
    const ids = res.json.mock.calls[0][0].data.incidents.map((i) => i.id);
    expect(ids).toEqual(['inc-own']);
  });
});

describe('incidents', () => {
  it('rejects a work note on another org\'s incident with 404', async () => {
    const res = await call(incidentCtrl.addWorkNote, mockReq({ params: { id: 'inc-victim' }, body: { content: 'x' } }));
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.workNote.create).not.toHaveBeenCalled();
  });

  it('hides another org\'s timeline', async () => {
    const res = await call(incidentCtrl.getTimeline, mockReq({ params: { id: 'inc-victim' } }));
    expect(statusOf(res)).toBe(404);
  });

  it('refuses to link a change from another org to an incident', async () => {
    const res = await call(incidentCtrl.linkChange, mockReq({ params: { id: 'inc-own' }, body: { changeId: 'chg-victim' } }));
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.incidentChange.create).not.toHaveBeenCalled();
  });

  it('links a change from the same org', async () => {
    const res = await call(incidentCtrl.linkChange, mockReq({ params: { id: 'inc-own' }, body: { changeId: 'chg-own' } }));
    expect(statusOf(res)).toBe(201);
  });

  it('refuses to assign an incident to another org\'s user', async () => {
    const res = await call(incidentCtrl.createIncident, mockReq({ body: { shortDescription: 's', assignedToId: 'user-victim' } }));
    expect(statusOf(res)).toBe(400);
    expect(mockPrisma.incident.create).not.toHaveBeenCalled();
  });
});

describe('problems', () => {
  it('rejects a note and an RCA update on another org\'s problem', async () => {
    const note = await call(problemCtrl.addWorkNote, mockReq({ params: { id: 'prb-victim' }, body: { content: 'x' } }));
    expect(statusOf(note)).toBe(404);
    const rca = await call(problemCtrl.updateRCA, mockReq({ params: { id: 'prb-victim' }, body: { rootCause: 'x' } }));
    expect(statusOf(rca)).toBe(404);
    expect(mockPrisma.problem.update).not.toHaveBeenCalled();
  });
});

describe('changes', () => {
  it('PATCH cannot move a change to another org', async () => {
    await call(changeCtrl.updateChange, mockReq({ params: { id: 'chg-own' }, body: { organizationId: 'victim', shortDescription: 'new' } }));
    const { data } = mockPrisma.change.update.mock.calls[0][0];
    expect(data).not.toHaveProperty('organizationId');
    expect(data.shortDescription).toBe('new');
  });

  it('cannot submit another org\'s change for approval', async () => {
    const res = await call(changeCtrl.submitForApproval, mockReq({ params: { id: 'chg-victim' } }));
    expect(statusOf(res)).toBe(404);
  });
});
