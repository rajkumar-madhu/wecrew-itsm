let rows = [];
const mockFindMany = jest.fn(async ({ where }) => rows.filter((r) =>
  r.isActive && where.OR.some((c) => c.organizationId === r.organizationId)));
const mockFindFirst = jest.fn(async ({ where }) => rows.find((r) => r.priority === where.priority && r.organizationId === where.organizationId) || null);
const mockCreate = jest.fn(async ({ data }) => { const r = { id: `id${rows.length}`, isActive: true, ...data }; rows.push(r); return r; });
const mockUpdate = jest.fn(async ({ where, data }) => { const r = rows.find((x) => x.id === where.id); Object.assign(r, data); return r; });
const mockDeleteMany = jest.fn(async ({ where }) => {
  const before = rows.length;
  rows = rows.filter((r) => !(r.priority === where.priority && r.organizationId === where.organizationId));
  return { count: before - rows.length };
});

jest.mock('../../config/database', () => ({
  prisma: {
    sLADefinition: {
      findMany: (...a) => mockFindMany(...a), findFirst: (...a) => mockFindFirst(...a),
      create: (...a) => mockCreate(...a), update: (...a) => mockUpdate(...a), deleteMany: (...a) => mockDeleteMany(...a),
    },
  },
}));
jest.mock('../../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const sla = require('../slaPolicyService');

beforeEach(() => { rows = []; sla.invalidate(); jest.clearAllMocks(); });

it('falls back to built-in defaults when no policy exists', async () => {
  expect(await sla.resolveSLATargets('P1', 'acme')).toEqual({ response: 5, resolution: 60 });
});

it('prefers the org policy over the platform policy', async () => {
  await sla.upsertPolicy(null, 'P1', { responseTimeMinutes: 10, resolutionTimeMinutes: 120 });
  await sla.upsertPolicy('acme', 'P1', { responseTimeMinutes: 3, resolutionTimeMinutes: 30 });
  expect(await sla.resolveSLATargets('P1', 'acme')).toEqual({ response: 3, resolution: 30 });
  expect(await sla.resolveSLATargets('P1', 'other')).toEqual({ response: 10, resolution: 120 });
});

it('reports where each effective value came from', async () => {
  await sla.upsertPolicy('acme', 'P2', { responseTimeMinutes: 20, resolutionTimeMinutes: 300 });
  const policies = await sla.getEffectivePolicies('acme');
  expect(policies.find((p) => p.priority === 'P2').source).toBe('organization');
  expect(policies.find((p) => p.priority === 'P3').source).toBe('default');
});

it('updates in place instead of creating a duplicate', async () => {
  await sla.upsertPolicy('acme', 'P1', { responseTimeMinutes: 3, resolutionTimeMinutes: 30 });
  await sla.upsertPolicy('acme', 'P1', { responseTimeMinutes: 4, resolutionTimeMinutes: 40 });
  expect(rows).toHaveLength(1);
  expect(await sla.resolveSLATargets('P1', 'acme')).toEqual({ response: 4, resolution: 40 });
});

it('reset removes the override and the cache entry', async () => {
  await sla.upsertPolicy('acme', 'P1', { responseTimeMinutes: 3, resolutionTimeMinutes: 30 });
  await sla.resolveSLATargets('P1', 'acme');
  await sla.resetPolicy('acme', 'P1');
  expect(await sla.resolveSLATargets('P1', 'acme')).toEqual({ response: 5, resolution: 60 });
});

it('uses defaults when the database lookup fails', async () => {
  mockFindMany.mockRejectedValueOnce(new Error('db down'));
  expect(await sla.resolveSLATargets('P2', 'acme')).toEqual({ response: 15, resolution: 240 });
});

it('computes target timestamps from the resolved policy', async () => {
  await sla.upsertPolicy('acme', 'P1', { responseTimeMinutes: 3, resolutionTimeMinutes: 30 });
  const t = await sla.calculateSLATargetTimesForOrg('P1', new Date('2026-01-01T00:00:00Z'), 'acme');
  expect(t.slaTargetResponse.toISOString()).toBe('2026-01-01T00:03:00.000Z');
  expect(t.slaTargetResolution.toISOString()).toBe('2026-01-01T00:30:00.000Z');
});
