// ═══════════════════════════════════════════════════════════
// OIDC service: URL/host vetting, domain rules, discovery and id_token checks.
// ═══════════════════════════════════════════════════════════

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('dns', () => ({ promises: { lookup: jest.fn(async () => [{ address: '93.184.216.34' }]) } }));

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const dns = require('dns').promises;
const sso = require('../sso.service');

const { isPrivateAddress, checkUrl, metaCache } = sso._internal;
const ISSUER = 'https://idp.example.com';
const CLIENT = 'argus-client';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' };
const DOC = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  jwks_uri: `${ISSUER}/jwks`,
};

function idToken(claims = {}, opts = {}) {
  return jwt.sign({ sub: 'abc', email: 'jo@acme.io', nonce: 'n1', ...claims }, privateKey, {
    algorithm: 'RS256', keyid: 'k1', issuer: ISSUER, audience: CLIENT, expiresIn: 300, ...opts,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  metaCache.clear();
  delete process.env.SSO_ALLOW_PRIVATE_ISSUERS;
  axios.get.mockImplementation(async (url) => ({ data: url.endsWith('/jwks') ? { keys: [JWK] } : DOC }));
});

describe('host and URL vetting', () => {
  it('recognises private, loopback and link-local addresses', () => {
    for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.20.0.1', '192.168.1.1', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('2606:4700::1111')).toBe(false);
  });

  it('requires https and no embedded credentials', () => {
    expect(() => checkUrl('http://idp.example.com')).toThrow(/https/);
    expect(() => checkUrl('https://u:p@idp.example.com')).toThrow(/credentials/);
    expect(checkUrl('https://idp.example.com/x').hostname).toBe('idp.example.com');
  });

  it('refuses an issuer that resolves to an internal address', async () => {
    dns.lookup.mockResolvedValueOnce([{ address: '10.96.0.10' }]);
    await expect(sso.discover('https://keycloak.internal')).rejects.toThrow(/not a public address/);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('allows a private issuer only when explicitly enabled', async () => {
    process.env.SSO_ALLOW_PRIVATE_ISSUERS = 'true';
    axios.get.mockResolvedValueOnce({ data: { ...DOC, issuer: 'http://keycloak:8080/realms/acme' } });
    const doc = await sso.discover('http://keycloak:8080/realms/acme');
    expect(doc.issuer).toBe('http://keycloak:8080/realms/acme');
  });
});

describe('domains', () => {
  it('normalises, de-duplicates and accepts company domains', () => {
    expect(sso.cleanDomains(' @Acme.io, acme.io  eu.acme.io')).toEqual(['acme.io', 'eu.acme.io']);
  });
  it('rejects public mail providers and junk', () => {
    expect(() => sso.cleanDomains(['gmail.com'])).toThrow(/public mail provider/);
    expect(() => sso.cleanDomains(['not a domain'])).toThrow(/not a domain/);
    expect(() => sso.cleanDomains([])).toThrow(/at least one/);
  });
  it('reads the domain from an address', () => {
    expect(sso.emailDomain('Jo@ACME.io')).toBe('acme.io');
    expect(sso.emailDomain('nope')).toBe('');
  });
});

describe('discovery', () => {
  it('rejects a document whose issuer differs from the configured one', async () => {
    axios.get.mockResolvedValueOnce({ data: { ...DOC, issuer: 'https://evil.example.com' } });
    await expect(sso.discover(ISSUER)).rejects.toThrow(/reports issuer/);
  });
  it('caches the document', async () => {
    await sso.discover(ISSUER);
    await sso.discover(ISSUER);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});

describe('authorization request', () => {
  it('uses the code flow with PKCE S256, state and nonce', () => {
    const { verifier, challenge } = sso.pkcePair();
    expect(challenge).toBe(crypto.createHash('sha256').update(verifier).digest('base64url'));
    const url = new URL(sso.authorizationUrl(DOC, {
      clientId: CLIENT, redirectUri: 'https://itsm.example/cb', state: 's', nonce: 'n', challenge, loginHint: 'jo@acme.io',
    }));
    expect(url.origin + url.pathname).toBe(`${ISSUER}/authorize`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code', client_id: CLIENT, state: 's', nonce: 'n', code_challenge: challenge,
      code_challenge_method: 'S256', scope: 'openid email profile', login_hint: 'jo@acme.io',
    });
  });
});

describe('token exchange', () => {
  it('sends client_secret_basic with the PKCE verifier', async () => {
    axios.post.mockResolvedValueOnce({ data: { id_token: 'x' } });
    await sso.exchangeCode(DOC, { clientId: CLIENT, clientSecret: 's3cr:et', code: 'c', redirectUri: 'https://r', verifier: 'v' });
    const [url, body, { headers }] = axios.post.mock.calls[0];
    expect(url).toBe(`${ISSUER}/token`);
    expect(new URLSearchParams(body).get('code_verifier')).toBe('v');
    expect(Buffer.from(headers.Authorization.split(' ')[1], 'base64').toString()).toBe('argus-client:s3cr%3Aet');
  });
  it('fails clearly when no id_token comes back', async () => {
    axios.post.mockResolvedValueOnce({ data: { access_token: 'a' } });
    await expect(sso.exchangeCode(DOC, { clientId: CLIENT, clientSecret: 's', code: 'c', redirectUri: 'r', verifier: 'v' }))
      .rejects.toMatchObject({ code: 'bad_token' });
  });
});

describe('id_token verification', () => {
  const verify = (token, nonce = 'n1') => sso.verifyIdToken(token, { issuer: ISSUER, doc: DOC, clientId: CLIENT, nonce });

  it('accepts a correctly signed token', async () => {
    const claims = await verify(idToken());
    expect(claims).toMatchObject({ sub: 'abc', email: 'jo@acme.io' });
  });
  it('rejects a wrong nonce, audience, issuer or an expired token', async () => {
    await expect(verify(idToken(), 'other')).rejects.toThrow(/Nonce/);
    await expect(verify(idToken({}, { audience: 'someone-else' }))).rejects.toThrow(/audience/);
    await expect(verify(idToken({}, { issuer: 'https://evil' }))).rejects.toThrow(/issuer/);
    await expect(verify(idToken({}, { expiresIn: -120 }))).rejects.toThrow(/expired/);
  });
  it('rejects a token signed by a different key', async () => {
    const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    const forged = jwt.sign({ sub: 'abc', nonce: 'n1' }, other, { algorithm: 'RS256', keyid: 'k1', issuer: ISSUER, audience: CLIENT });
    await expect(verify(forged)).rejects.toThrow(/signature/);
  });
  it('rejects an unsigned (alg none) token', async () => {
    const none = jwt.sign({ sub: 'abc', nonce: 'n1', iss: ISSUER, aud: CLIENT }, null, { algorithm: 'none' });
    await expect(verify(none)).rejects.toMatchObject({ code: 'bad_token' });
  });
});

describe('names', () => {
  it('prefers given/family name, then name, then the mailbox', () => {
    expect(sso.namesFrom({ given_name: 'Jo', family_name: 'Lee' }, 'x@a.io')).toEqual({ firstName: 'Jo', lastName: 'Lee' });
    expect(sso.namesFrom({ name: 'Ana Maria Silva' }, 'x@a.io')).toEqual({ firstName: 'Ana', lastName: 'Maria Silva' });
    expect(sso.namesFrom({}, 'priya@a.io')).toEqual({ firstName: 'priya', lastName: '' });
  });
});
