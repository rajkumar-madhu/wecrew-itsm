const mockPrisma = {
  subscription: { create: jest.fn(), findUnique: jest.fn() },
  user: { count: jest.fn() },
};
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));

const { startTrial, getAccessState, countBillableSeats, TRIAL_DAYS } = require('../billing.service');

beforeEach(() => jest.clearAllMocks());

describe('startTrial', () => {
  it('creates a TRIALING subscription ending 20 days out', async () => {
    mockPrisma.subscription.create.mockResolvedValue({ id: 's1' });
    await startTrial(mockPrisma, 'org1');

    const arg = mockPrisma.subscription.create.mock.calls[0][0].data;
    expect(arg.organizationId).toBe('org1');
    expect(arg.tier).toBe('TRIAL');
    expect(arg.status).toBe('TRIALING');
    expect(arg.seatLimit).toBe(10);

    const days = Math.round((arg.trialEndsAt - Date.now()) / 86400000);
    expect(days).toBe(TRIAL_DAYS);
  });
});

describe('countBillableSeats', () => {
  it('counts ACTIVE non-VIEWER users only', async () => {
    mockPrisma.user.count.mockResolvedValue(4);
    const n = await countBillableSeats('org1');
    expect(n).toBe(4);
    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: { organizationId: 'org1', status: 'ACTIVE', role: { not: 'VIEWER' } },
    });
  });
});

describe('getAccessState', () => {
  it('is read-only when the trial has expired', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      tier: 'TRIAL', status: 'TRIALING', seatLimit: 10,
      trialEndsAt: new Date(Date.now() - 86400000), currentPeriodEnd: null,
    });
    mockPrisma.user.count.mockResolvedValue(2);

    const s = await getAccessState('org1');
    expect(s.isReadOnly).toBe(true);
    expect(s.daysRemaining).toBe(0);
  });

  it('is writable during an active trial', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      tier: 'TRIAL', status: 'TRIALING', seatLimit: 10,
      trialEndsAt: new Date(Date.now() + 5 * 86400000), currentPeriodEnd: null,
    });
    mockPrisma.user.count.mockResolvedValue(2);

    const s = await getAccessState('org1');
    expect(s.isReadOnly).toBe(false);
    expect(s.daysRemaining).toBe(5);
  });

  it('is writable when ACTIVE regardless of trialEndsAt', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      tier: 'STARTER', status: 'ACTIVE', seatLimit: 10,
      trialEndsAt: new Date(Date.now() - 90 * 86400000),
      currentPeriodEnd: new Date(Date.now() + 300 * 86400000),
    });
    mockPrisma.user.count.mockResolvedValue(7);

    const s = await getAccessState('org1');
    expect(s.isReadOnly).toBe(false);
  });

  it('is read-only when HALTED', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      tier: 'STARTER', status: 'HALTED', seatLimit: 10,
      trialEndsAt: new Date(Date.now() - 90 * 86400000), currentPeriodEnd: null,
    });
    mockPrisma.user.count.mockResolvedValue(7);

    expect((await getAccessState('org1')).isReadOnly).toBe(true);
  });

  it('grants access when an org has no subscription row', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    const s = await getAccessState('org1');
    expect(s.isReadOnly).toBe(false);
    expect(s.status).toBe('NONE');
  });
});
