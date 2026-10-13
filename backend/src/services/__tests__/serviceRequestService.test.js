const mockTx = jest.fn(async (ops) => Promise.all(ops));
const mockApprovalFind = jest.fn();
const mockApprovalUpdate = jest.fn(async ({ data }) => data);
const mockRequestUpdate = jest.fn(async ({ data }) => ({ id: 'r1', ...data }));
const mockItemFind = jest.fn(async () => ({ fulfillmentHours: 24 }));
const mockNotify = jest.fn();
jest.mock('../../config/database', () => ({
  prisma: {
    $transaction: (...a) => mockTx(...a),
    requestApproval: { findUnique: (...a) => mockApprovalFind(...a), update: (...a) => mockApprovalUpdate(...a) },
    serviceRequest: { update: (...a) => mockRequestUpdate(...a) },
    serviceCatalogItem: { findUnique: (...a) => mockItemFind(...a) },
  },
}));
jest.mock('../notificationService', () => ({ createNotification: (...a) => mockNotify(...a) }));
jest.mock('../../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const svc = require('../serviceRequestService');

const FORM = [
  { key: 'laptop', label: 'Laptop model', type: 'select', options: ['Mac', 'ThinkPad'], required: true },
  { key: 'qty', label: 'Quantity', type: 'number' },
  { key: 'needBy', label: 'Needed by', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

beforeEach(() => jest.clearAllMocks());

describe('form schema', () => {
  it('accepts a valid form', () => expect(svc.validateFormSchema(FORM)).toBeNull());
  it.each([
    ['not a list', {}],
    ['bad key', [{ key: '1x', label: 'A', type: 'text' }]],
    ['duplicate key', [{ key: 'a', label: 'A', type: 'text' }, { key: 'a', label: 'B', type: 'text' }]],
    ['unknown type', [{ key: 'a', label: 'A', type: 'file' }]],
    ['select without options', [{ key: 'a', label: 'A', type: 'select' }]],
  ])('rejects %s', (_l, schema) => expect(svc.validateFormSchema(schema)).toEqual(expect.any(String)));
});

describe('form answers', () => {
  it('cleans and types the answers', () => {
    expect(svc.validateFormData(FORM, { laptop: 'Mac', qty: '2', needBy: '2026-11-01', extra: 'dropped' }))
      .toEqual({ laptop: 'Mac', qty: 2, needBy: '2026-11-01' });
  });
  it.each([
    ['missing required', {}],
    ['option not offered', { laptop: 'Dell' }],
    ['non-numeric number', { laptop: 'Mac', qty: 'two' }],
    ['bad date', { laptop: 'Mac', needBy: '01/11/2026' }],
  ])('rejects %s', (_l, data) => expect(() => svc.validateFormData(FORM, data)).toThrow(svc.RequestError));
});

describe('approval decisions', () => {
  const request = { id: 'r1', number: 'REQ0000001', state: 'PENDING_APPROVAL', catalogItemId: 'c1', requestedById: 'u-req' };

  it('approves, sets the due date and tells the requester', async () => {
    mockApprovalFind.mockResolvedValueOnce({ id: 'a1', state: 'PENDING' });
    await svc.decide({ request, approverId: 'u-mgr', approve: true });
    const data = mockRequestUpdate.mock.calls[0][0].data;
    expect(data.state).toBe('APPROVED');
    expect(data.dueAt.getTime() - data.approvedAt.getTime()).toBe(24 * 3600000);
    expect(mockNotify).toHaveBeenCalledWith('u-req', 'SYSTEM', 'REQ0000001 approved', expect.any(String), '/portal/requests/r1');
  });

  it('rejects and closes the request', async () => {
    mockApprovalFind.mockResolvedValueOnce({ id: 'a1', state: 'PENDING' });
    await svc.decide({ request, approverId: 'u-mgr', approve: false, comments: 'No budget' });
    expect(mockRequestUpdate.mock.calls[0][0].data).toMatchObject({ state: 'REJECTED', resolutionNotes: 'No budget' });
  });

  it('refuses someone who is not an approver', async () => {
    mockApprovalFind.mockResolvedValueOnce(null);
    await expect(svc.decide({ request, approverId: 'u-x', approve: true })).rejects.toMatchObject({ status: 403 });
  });

  it('refuses once the request is no longer pending', async () => {
    await expect(svc.decide({ request: { ...request, state: 'APPROVED' }, approverId: 'u-mgr', approve: true })).rejects.toMatchObject({ status: 409 });
  });
});

describe('state changes', () => {
  it('blocks skipping approval through a plain state change', async () => {
    await expect(svc.transition({ request: { id: 'r1', state: 'PENDING_APPROVAL' }, to: 'APPROVED' })).rejects.toMatchObject({ status: 409 });
  });
  it('blocks reopening a fulfilled request', async () => {
    await expect(svc.transition({ request: { id: 'r1', state: 'FULFILLED' }, to: 'IN_FULFILLMENT' })).rejects.toMatchObject({ status: 409 });
  });
  it('assigns the agent who starts fulfilment', async () => {
    await svc.transition({ request: { id: 'r1', state: 'APPROVED', requestedById: 'u-req' }, to: 'IN_FULFILLMENT', actor: { id: 'u-agent' } });
    expect(mockRequestUpdate.mock.calls[0][0].data).toMatchObject({ state: 'IN_FULFILLMENT', assignedToId: 'u-agent' });
  });
});

describe('satisfaction rating', () => {
  it('accepts 1-5', () => expect(svc.validateCsat(4, 'Quick fix')).toMatchObject({ csatScore: 4, csatComment: 'Quick fix' }));
  it.each([0, 6, 3.5, 'x'])('rejects %p', (s) => expect(() => svc.validateCsat(s)).toThrow(svc.RequestError));
});
