// Password reset: no enumeration, hashed single-use tokens, sessions revoked.
const crypto = require('crypto');

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn((a) => a) },
  passwordResetToken: {
    findFirst: jest.fn(), findUnique: jest.fn(),
    create: jest.fn((a) => a), deleteMany: jest.fn((a) => a), updateMany: jest.fn((a) => a),
  },
  session: { deleteMany: jest.fn((a) => a) },
  $transaction: jest.fn(async (ops) => ops),
};
const mockSend = jest.fn(async () => {});
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../config/env', () => ({ config: { frontendUrl: 'https://incident.wecrew.in/' } }));
jest.mock('../emailService', () => ({ sendEmail: (...a) => mockSend(...a) }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { requestReset, resetPassword, hashToken } = require('../passwordReset.service');

beforeEach(() => jest.clearAllMocks());

describe('requestReset', () => {
  it('sends nothing for an unknown address (and does not throw)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(requestReset('nobody@example.com')).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('stores only the hash of the emailed token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: '<b>A</b>', status: 'ACTIVE' });
    mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);
    await requestReset('a@b.com');

    const html = mockSend.mock.calls[0][2];
    const raw = decodeURIComponent(html.match(/token=([^"]+)"/)[1]);
    const stored = mockPrisma.passwordResetToken.create.mock.calls[0][0].data.tokenHash;
    expect(stored).toBe(crypto.createHash('sha256').update(raw).digest('hex'));
    expect(stored).not.toContain(raw);
    expect(html).toContain('https://incident.wecrew.in/reset-password?token=');
    expect(html).toContain('&lt;b&gt;A&lt;/b&gt;'); // name is escaped
  });

  it('throttles repeat requests', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'A', status: 'ACTIVE' });
    mockPrisma.passwordResetToken.findFirst.mockResolvedValue({ id: 't-recent' });
    await requestReset('a@b.com');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('ignores deactivated accounts', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', status: 'INACTIVE' });
    await requestReset('a@b.com');
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('resetPassword', () => {
  const live = (over = {}) => ({
    id: 't1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60000),
    user: { id: 'u1', status: 'LOCKED' }, ...over,
  });

  it('rejects unknown, used and expired tokens', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);
    expect(await resetPassword('x'.repeat(40), 'NewPass123')).toBe(false);
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(live({ usedAt: new Date() }));
    expect(await resetPassword('x'.repeat(40), 'NewPass123')).toBe(false);
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(live({ expiresAt: new Date(Date.now() - 1) }));
    expect(await resetPassword('x'.repeat(40), 'NewPass123')).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('looks the token up by hash, sets a bcrypt password, unlocks, and revokes sessions', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(live());
    expect(await resetPassword('raw-token-value-xxxxxxxx', 'NewPass123')).toBe(true);
    expect(mockPrisma.passwordResetToken.findUnique.mock.calls[0][0].where.tokenHash).toBe(hashToken('raw-token-value-xxxxxxxx'));
    const userUpdate = mockPrisma.user.update.mock.calls[0][0].data;
    expect(userUpdate.password).toMatch(/^\$2[aby]\$12\$/);
    expect(userUpdate.status).toBe('ACTIVE');
    expect(userUpdate.loginAttempts).toBe(0);
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(mockPrisma.passwordResetToken.updateMany.mock.calls[0][0].where).toEqual({ id: 't1', usedAt: null });
  });
});
