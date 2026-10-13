// ═══════════════════════════════════════════════════════════
// Argus ITSM — TOTP MFA Service
// Secrets are stored AES-256-GCM encrypted (key from MFA_ENCRYPTION_KEY,
// falling back to JWT_SECRET) so a DB dump alone can't mint codes.
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const speakeasy = require('speakeasy');

const ISSUER = 'Argus ITSM';
const PREFIX = 'v1:';

function key() {
  const material = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!material) throw new Error('MFA_ENCRYPTION_KEY or JWT_SECRET must be set');
  return crypto.createHash('sha256').update(material).digest();
}

function encryptSecret(base32) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(base32, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptSecret(stored) {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

function generateSecret(email) {
  const secret = speakeasy.generateSecret({ length: 20, name: `${ISSUER} (${email})`, issuer: ISSUER });
  return { base32: secret.base32, otpauthUrl: secret.otpauth_url };
}

// Accepts the current code ±1 step (30s) for clock drift
function verifyCode(storedSecret, code) {
  const token = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(token)) return false;
  let secret;
  try { secret = decryptSecret(storedSecret); } catch { return false; }
  if (!secret) return false;
  return speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
}

module.exports = { encryptSecret, decryptSecret, generateSecret, verifyCode };
