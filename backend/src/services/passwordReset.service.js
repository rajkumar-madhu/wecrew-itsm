// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Password reset
//
// - The emailed token is 32 random bytes; only its SHA-256 is stored, so a
//   database read never yields a working reset link.
// - Single use, 30-minute lifetime, one live token per user.
// - requestReset never reveals whether an address has an account: the caller
//   always answers the same way.
// - A reset revokes every session, and authenticate() rejects access tokens
//   issued before passwordChangedAt, so a stolen session dies with the reset.
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { config } = require('../config/env');
const logger = require('../utils/logger');
const { sendEmail } = require('./emailService');

const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // stops using the endpoint to flood one inbox
const SALT_ROUNDS = 12;

const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Always resolves; the outcome is deliberately not observable by the caller. */
async function requestReset(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, status: true },
  });
  if (!user || user.status === 'INACTIVE') return;

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, usedAt: null, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    select: { id: true },
  });
  if (recent) return;

  const raw = crypto.randomBytes(32).toString('base64url');
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    }),
  ]);

  const link = `${config.frontendUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(raw)}`;
  // Swallow send failures so the HTTP answer stays identical for known vs
  // unknown addresses (no 500-based enumeration).
  try {
    await sendEmail(user.email, 'Reset your WeCrew ITSM password', `
    <p>Hi ${escapeHtml(user.firstName || 'there')},</p>
    <p>Someone asked to reset the password for your WeCrew ITSM account. If it was you, use the link below —
    it works once and expires in 30 minutes.</p>
    <p><a href="${link}">Reset your password</a></p>
    <p>If you didn't ask for this, you can ignore this email; your password has not changed.</p>`);
  } catch (err) {
    logger.error(`[auth] password reset email failed for user ${user.id}: ${err.message}`);
  }
  logger.info(`[auth] password reset requested for user ${user.id}`);
}

/** → true when the password was changed; false for an unknown/used/expired token. */
async function resetPassword(rawToken, newPassword) {
  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, status: true } } },
  });
  if (!token || token.usedAt || token.expiresAt.getTime() < Date.now()) return false;
  if (!token.user || token.user.status === 'INACTIVE') return false;

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  // Interactive transaction so the claim gates the password write: a concurrent
  // second use sees updateMany count 0 and aborts before changing the hash.
  const ok = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return false;

    await tx.user.update({
      where: { id: token.userId },
      data: {
        password: hashed,
        passwordChangedAt: new Date(),
        loginAttempts: 0,
        lockedUntil: null,
        ...(token.user.status === 'LOCKED' ? { status: 'ACTIVE' } : {}),
      },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId: token.userId, id: { not: token.id } } });
    await tx.session.deleteMany({ where: { userId: token.userId } });
    return true;
  });

  if (ok) logger.info(`[auth] password reset completed for user ${token.userId}`);
  return ok;
}

module.exports = { requestReset, resetPassword, hashToken, TOKEN_TTL_MS };
