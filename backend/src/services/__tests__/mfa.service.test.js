// TOTP: encrypted at rest, codes single-use, challenge token is not an access token.
const speakeasy = require('speakeasy');

process.env.JWT_SECRET = 'test-jwt-secret';
const mfa = require('../mfa.service');
const { verifyAccessToken } = require('../../utils/jwt');

const codeFor = (base32, offsetSteps = 0) => speakeasy.totp({
  secret: base32, encoding: 'base32', time: Math.floor(Date.now() / 1000) + offsetSteps * 30,
});

describe('secret storage', () => {
  it('stores the secret encrypted and decrypts it back', () => {
    const { encrypted, base32, otpauthUrl } = mfa.createSecret('a@b.com');
    expect(encrypted).not.toContain(base32);
    expect(mfa.decryptSecret(encrypted)).toBe(base32);
    expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(decodeURIComponent(otpauthUrl)).toContain('a@b.com');
  });

  it('rejects a tampered secret', () => {
    const { encrypted } = mfa.createSecret('a@b.com');
    const parts = encrypted.split(':');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => mfa.decryptSecret(parts.join(':'))).toThrow();
  });
});

describe('verifyCode', () => {
  const { encrypted, base32 } = mfa.createSecret('a@b.com');

  it('accepts the current code and returns its time step', () => {
    const step = mfa.verifyCode(encrypted, codeFor(base32), null);
    expect(step).toBe(Math.floor(Date.now() / 1000 / 30));
  });

  it('accepts a code with spaces, as people type it', () => {
    const c = codeFor(base32);
    expect(mfa.verifyCode(encrypted, `${c.slice(0, 3)} ${c.slice(3)}`, null)).not.toBeNull();
  });

  it('refuses a code that was already used', () => {
    const step = mfa.verifyCode(encrypted, codeFor(base32), null);
    expect(mfa.verifyCode(encrypted, codeFor(base32), step)).toBeNull();
  });

  it('refuses wrong, malformed and far-off codes', () => {
    const right = codeFor(base32);
    const wrong = String((Number(right) + 1) % 1000000).padStart(6, '0');
    expect(mfa.verifyCode(encrypted, wrong, null)).toBeNull();
    expect(mfa.verifyCode(encrypted, 'abcdef', null)).toBeNull();
    expect(mfa.verifyCode(encrypted, codeFor(base32, 10), null)).toBeNull();
    expect(mfa.verifyCode(null, right, null)).toBeNull();
  });
});

describe('login challenge token', () => {
  it('round-trips the user id', () => {
    expect(mfa.verifyChallenge(mfa.signChallenge('u1'))).toBe('u1');
  });

  it('can never be used as an access token', () => {
    expect(() => verifyAccessToken(mfa.signChallenge('u1'))).toThrow();
  });

  it('rejects garbage', () => {
    expect(mfa.verifyChallenge('not-a-token')).toBeNull();
    expect(mfa.verifyChallenge(undefined)).toBeNull();
  });
});
