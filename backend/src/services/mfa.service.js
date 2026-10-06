// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Two-factor authentication (TOTP)
//
// - The TOTP secret is stored AES-256-GCM encrypted, so a database read
//   alone cannot mint codes. Key: MFA_ENCRYPTION_KEY, else derived from
//   JWT_SECRET (rotating JWT_SECRET then invalidates every enrolment).
// - A code is accepted at most once: the time step it matched is stored
//   and any step at or before it is refused, so a sniffed code is dead.
// - Login with MFA is two calls. The password step returns a 5-minute
//   challenge token signed with a key derived from — but not equal to —
//   JWT_SECRET, so authenticate() can never accept it as an access token.
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

const ISSUER = 'WeCrew ITSM';
const STEP_SECONDS = 30;
const DRIFT_STEPS = 1; // accept the previous/next code for clock skew
const CHALLENGE_TTL = '5m';

const deriveKey = (label) => crypto.createHash('sha256')
  .update(`${process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET}:${label}`).digest();

function encryptSecret(base32) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey('mfa-secret'), iv);
  const data = Buffer.concat([cipher.update(base32, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

function decryptSecret(stored) {
  const [version, iv, tag, data] = String(stored).split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable MFA secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey('mfa-secret'), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

/** New, not-yet-enabled enrolment → { encrypted, base32, otpauthUrl }. */
function createSecret(email) {
  const secret = speakeasy.generateSecret({ length: 20, name: `${ISSUER} (${email})`, issuer: ISSUER });
  return { encrypted: encryptSecret(secret.base32), base32: secret.base32, otpauthUrl: secret.otpauth_url };
}

/**
 * Check a 6-digit code against the stored secret.
 * → the matched time step (store it as mfaLastUsedStep), or null.
 */
function verifyCode(storedSecret, code, lastUsedStep) {
  const token = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(token) || !storedSecret) return null;
  let base32;
  try { base32 = decryptSecret(storedSecret); } catch { return null; }

  const match = speakeasy.totp.verifyDelta({
    secret: base32, encoding: 'base32', token, window: DRIFT_STEPS, step: STEP_SECONDS,
  });
  if (!match) return null;
  const step = Math.floor(Date.now() / 1000 / STEP_SECONDS) + match.delta;
  if (lastUsedStep != null && step <= lastUsedStep) return null; // replay
  return step;
}

const challengeKey = () => deriveKey('mfa-challenge');

function signChallenge(userId) {
  return jwt.sign({ id: userId, purpose: 'mfa' }, challengeKey(), { expiresIn: CHALLENGE_TTL });
}

/** → userId, or null for a bad/expired challenge. */
function verifyChallenge(token) {
  try {
    const decoded = jwt.verify(String(token || ''), challengeKey());
    return decoded.purpose === 'mfa' ? decoded.id : null;
  } catch { return null; }
}

module.exports = {
  createSecret, verifyCode, signChallenge, verifyChallenge, encryptSecret, decryptSecret,
};
