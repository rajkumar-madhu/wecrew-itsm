const mockFindMany = jest.fn(async () => []);
const mockCount = jest.fn(async () => 0);
jest.mock('../../config/database', () => ({
  prisma: {
    auditLog: { findMany: (...a) => mockFindMany(...a), count: (...a) => mockCount(...a) },
    $transaction: (ops) => Promise.all(ops),
  },
}));

const { listAuditLogs, getEntityTypes } = require('../audit.controller');

function res() { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; }
const next = (e) => { throw e; };

beforeEach(() => jest.clearAllMocks());

it('scopes an org ADMIN to entries made by users of their org', async () => {
  await listAuditLogs({ query: {}, user: { role: 'ADMIN', isPlatformAdmin: false, organizationId: 'acme' } }, res(), next);
  expect(mockFindMany.mock.calls[0][0].where.user).toEqual({ is: { organizationId: 'acme' } });
});

it('shows a platform admin everything', async () => {
  await listAuditLogs({ query: {}, user: { role: 'ADMIN', isPlatformAdmin: true, organizationId: 'wecrew' } }, res(), next);
  expect(mockFindMany.mock.calls[0][0].where.user).toBeUndefined();
});

it('scopes entity types too', async () => {
  await getEntityTypes({ user: { role: 'MANAGER', organizationId: 'acme' } }, res(), next);
  expect(mockFindMany.mock.calls[0][0].where).toEqual({ user: { is: { organizationId: 'acme' } } });
});
