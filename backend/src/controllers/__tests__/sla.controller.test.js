const mockUpsert = jest.fn(async () => ({}));
const mockEffective = jest.fn(async () => []);
jest.mock('../../services/slaPolicyService', () => ({
  upsertPolicy: (...a) => mockUpsert(...a),
  getEffectivePolicies: (...a) => mockEffective(...a),
  resetPolicy: jest.fn(async () => 1),
}));
jest.mock('../../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const { updatePolicy } = require('../sla.controller');

function res() { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; }
const req = (priority, body, organizationId = 'acme', user = { role: 'ADMIN', isPlatformAdmin: false }) => ({ params: { priority }, body, organizationId, user });

beforeEach(() => jest.clearAllMocks());

it('saves the policy into the caller tenant', async () => {
  const r = res();
  await updatePolicy(req('p1', { responseTimeMinutes: 5, resolutionTimeMinutes: 60 }), r);
  expect(r.status).toHaveBeenCalledWith(200);
  expect(mockUpsert).toHaveBeenCalledWith('acme', 'P1', expect.objectContaining({ responseTimeMinutes: 5, resolutionTimeMinutes: 60 }));
});

it.each([
  ['unknown priority', 'P9', { responseTimeMinutes: 5, resolutionTimeMinutes: 60 }],
  ['non-integer minutes', 'P1', { responseTimeMinutes: 1.5, resolutionTimeMinutes: 60 }],
  ['zero minutes', 'P1', { responseTimeMinutes: 0, resolutionTimeMinutes: 60 }],
  ['resolution shorter than response', 'P1', { responseTimeMinutes: 60, resolutionTimeMinutes: 30 }],
  ['non-boolean businessHoursOnly', 'P1', { responseTimeMinutes: 5, resolutionTimeMinutes: 60, businessHoursOnly: 'yes' }],
])('rejects %s', async (_label, priority, body) => {
  const r = res();
  await updatePolicy(req(priority, body), r);
  expect(r.status).toHaveBeenCalledWith(400);
  expect(mockUpsert).not.toHaveBeenCalled();
});

it('blocks a non-platform admin without an org from editing the platform-wide policy', async () => {
  const r = res();
  await updatePolicy(req('P1', { responseTimeMinutes: 5, resolutionTimeMinutes: 60 }, null), r);
  expect(r.status).toHaveBeenCalledWith(403);
  expect(mockUpsert).not.toHaveBeenCalled();
});

it('lets a platform admin edit the platform-wide policy', async () => {
  const r = res();
  await updatePolicy(req('P1', { responseTimeMinutes: 5, resolutionTimeMinutes: 60 }, null, { role: 'ADMIN', isPlatformAdmin: true }), r);
  expect(mockUpsert).toHaveBeenCalledWith(null, 'P1', expect.anything());
});
