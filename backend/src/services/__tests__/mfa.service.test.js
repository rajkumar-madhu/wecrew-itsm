process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const speakeasy = require('speakeasy');
const mfa = require('../mfa.service');

const { base32 } = mfa.generateSecret('ops@example.com');

it('stores the secret encrypted and decrypts it back', () => {
  const stored = mfa.encryptSecret(base32);
  expect(stored.startsWith('v1:')).toBe(true);
  expect(stored).not.toContain(base32);
  expect(mfa.decryptSecret(stored)).toBe(base32);
});

it('accepts the current code and rejects malformed ones', () => {
  const stored = mfa.encryptSecret(base32);
  const code = speakeasy.totp({ secret: base32, encoding: 'base32' });
  expect(mfa.verifyCode(stored, code)).toBe(true);
  expect(mfa.verifyCode(stored, '12ab56')).toBe(false);
  expect(mfa.verifyCode(stored, '')).toBe(false);
});

it('rejects codes when the stored secret was tampered with', () => {
  const stored = mfa.encryptSecret(base32);
  const tampered = stored.slice(0, -4) + (stored.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  const code = speakeasy.totp({ secret: base32, encoding: 'base32' });
  expect(mfa.verifyCode(tampered, code)).toBe(false);
});
