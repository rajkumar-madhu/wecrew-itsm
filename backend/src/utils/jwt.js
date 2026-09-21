// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — JWT Utilities
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Include a unique jti on every mint. Session.token / Session.refreshToken are
// @unique; without jti, two logins in the same second for the same user mint
// identical JWTs and the second create throws P2002 ("Duplicate value for:
// token") — which the UI surfaces as a failed sign-in.
function jti() {
  return crypto.randomUUID();
}

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId || null, jti: jti() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh', jti: jti() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

module.exports = { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken };
