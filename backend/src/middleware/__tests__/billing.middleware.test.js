const mockGetAccessState = jest.fn();
const mockCountBillableSeats = jest.fn();

jest.mock('../../services/billing.service', () => ({
  getAccessState: (...a) => mockGetAccessState(...a),
  countBillableSeats: (...a) => mockCountBillableSeats(...a),
}));
jest.mock('../../config/database', () => ({
  prisma: { subscription: { findUnique: jest.fn() } },
}));

const { enforceWriteAccess, enforceSeatLimit } = require('../billing.middleware');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('enforceWriteAccess', () => {
  it('passes GET requests through even when read-only', async () => {
    const next = jest.fn();
    await enforceWriteAccess({ method: 'GET', path: '/incidents', user: { organizationId: 'o1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(mockGetAccessState).not.toHaveBeenCalled();
  });

  it('blocks POST with 402 when read-only', async () => {
    mockGetAccessState.mockResolvedValue({ isReadOnly: true, status: 'TRIALING' });
    const res = mockRes(); const next = jest.fn();
    await enforceWriteAccess({ method: 'POST', path: '/incidents', user: { organizationId: 'o1' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json.mock.calls[0][0].code).toBe('SUBSCRIPTION_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('allows POST /billing even when read-only', async () => {
    mockGetAccessState.mockResolvedValue({ isReadOnly: true, status: 'TRIALING' });
    const next = jest.fn();
    await enforceWriteAccess({ method: 'POST', path: '/billing/subscribe', user: { organizationId: 'o1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('allows POST when not read-only', async () => {
    mockGetAccessState.mockResolvedValue({ isReadOnly: false });
    const next = jest.fn();
    await enforceWriteAccess({ method: 'POST', path: '/incidents', user: { organizationId: 'o1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through when the user has no organization', async () => {
    const next = jest.fn();
    await enforceWriteAccess({ method: 'POST', path: '/incidents', user: { organizationId: null } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('enforceSeatLimit', () => {
  it('blocks a billable role at the cap', async () => {
    mockGetAccessState.mockResolvedValue({ seatsUsed: 10, seatLimit: 10 });
    const res = mockRes(); const next = jest.fn();
    await enforceSeatLimit({ body: { role: 'ENGINEER' }, user: { organizationId: 'o1' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json.mock.calls[0][0].code).toBe('SEAT_LIMIT_REACHED');
  });

  it('allows a VIEWER at the cap — viewers are free', async () => {
    mockGetAccessState.mockResolvedValue({ seatsUsed: 10, seatLimit: 10 });
    const next = jest.fn();
    await enforceSeatLimit({ body: { role: 'VIEWER' }, user: { organizationId: 'o1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('treats a missing role as VIEWER, matching register()', async () => {
    mockGetAccessState.mockResolvedValue({ seatsUsed: 10, seatLimit: 10 });
    const next = jest.fn();
    await enforceSeatLimit({ body: {}, user: { organizationId: 'o1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('allows a billable role below the cap', async () => {
    mockGetAccessState.mockResolvedValue({ seatsUsed: 3, seatLimit: 10 });
    const next = jest.fn();
    await enforceSeatLimit({ body: { role: 'ENGINEER' }, user: { organizationId: 'o1' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
