// ═══════════════════════════════════════════════════════════
// Argus ITSM — OpenID Connect single sign-on
// Authorization-code flow with PKCE against each organization's own IdP
// (Okta, Entra ID, Google Workspace, Keycloak, Auth0, …). The IdP URL is
// supplied by an org admin, so every server-side fetch is restricted to
// public HTTPS hosts unless SSO_ALLOW_PRIVATE_ISSUERS=true (self-hosted IdP).
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const CACHE_TTL = 60 * 60 * 1000;
const HTTP_TIMEOUT = 8000;
const ID_TOKEN_ALGS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512'];

// Shared consumer mailbox providers: a tenant must not route these to its IdP.
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com',
  'yahoo.co.in', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'zoho.com',
  'zohomail.in', 'yandex.com', 'gmx.com', 'mail.com', 'rediffmail.com',
]);

class SsoError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

const allowPrivate = () => process.env.SSO_ALLOW_PRIVATE_ISSUERS === 'true';

// ── URL and host checks ──────────────────────────────────

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

/** Parse and vet a URL the server will fetch or redirect to. */
function checkUrl(raw) {
  let url;
  try { url = new URL(String(raw)); } catch { throw new SsoError('bad_issuer', 'Not a valid URL'); }
  const localHttp = url.protocol === 'http:' && allowPrivate();
  if (url.protocol !== 'https:' && !localHttp) throw new SsoError('bad_issuer', 'The identity provider URL must use https');
  if (url.username || url.password) throw new SsoError('bad_issuer', 'The URL must not contain credentials');
  return url;
}

async function assertPublicHost(raw) {
  const url = checkUrl(raw);
  if (allowPrivate()) return url;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addrs;
  try {
    addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  } catch {
    throw new SsoError('unreachable', `Cannot resolve ${host}`);
  }
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new SsoError('bad_issuer', `${host} is not a public address`);
  }
  return url;
}

async function getJson(raw) {
  const url = await assertPublicHost(raw);
  try {
    const res = await axios.get(url.toString(), { timeout: HTTP_TIMEOUT, maxRedirects: 0, headers: { Accept: 'application/json' } });
    return res.data;
  } catch (err) {
    throw new SsoError('unreachable', `Could not read ${url.origin}${url.pathname} (${err.response?.status || err.code || 'error'})`);
  }
}

// ── Issuer metadata and keys ─────────────────────────────

function normalizeIssuer(raw) {
  const url = checkUrl(String(raw || '').trim());
  return url.toString().replace(/\/+$/, '');
}

const metaCache = new Map(); // issuer → { at, doc, jwks }

async function discover(issuer, { fresh = false } = {}) {
  const hit = metaCache.get(issuer);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL) return hit.doc;
  const doc = await getJson(`${issuer}/.well-known/openid-configuration`);
  if (!doc || typeof doc !== 'object') throw new SsoError('bad_issuer', 'The discovery document is not JSON');
  // OIDC Discovery §4.3: the document's issuer must equal the URL it came from
  if (String(doc.issuer || '').replace(/\/+$/, '') !== issuer) {
    throw new SsoError('bad_issuer', `The provider reports issuer "${doc.issuer}", expected "${issuer}"`);
  }
  for (const k of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
    if (!doc[k]) throw new SsoError('bad_issuer', `The discovery document has no ${k}`);
    checkUrl(doc[k]);
  }
  metaCache.set(issuer, { at: Date.now(), doc, jwks: null });
  return doc;
}

async function signingKey(issuer, doc, kid) {
  const entry = metaCache.get(issuer) || { at: Date.now(), doc };
  const find = (jwks) => (jwks?.keys || []).find((k) => (!kid || k.kid === kid) && (!k.use || k.use === 'sig'));
  let jwk = find(entry.jwks);
  if (!jwk) { // first use, or the IdP rotated its keys
    entry.jwks = await getJson(doc.jwks_uri);
    metaCache.set(issuer, entry);
    jwk = find(entry.jwks);
  }
  if (!jwk) throw new SsoError('bad_token', 'No matching signing key');
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

// ── Flow pieces ──────────────────────────────────────────

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomToken = () => b64url(crypto.randomBytes(32));

function pkcePair() {
  const verifier = randomToken();
  return { verifier, challenge: b64url(crypto.createHash('sha256').update(verifier).digest()) };
}

function authorizationUrl(doc, { clientId, redirectUri, state, nonce, challenge, loginHint }) {
  const url = new URL(doc.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (loginHint) url.searchParams.set('login_hint', loginHint);
  return url.toString();
}

async function exchangeCode(doc, { clientId, clientSecret, code, redirectUri, verifier }) {
  const url = await assertPublicHost(doc.token_endpoint);
  const form = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
  const methods = doc.token_endpoint_auth_methods_supported || ['client_secret_basic'];
  if (!methods.includes('client_secret_basic') && methods.includes('client_secret_post')) {
    form.set('client_id', clientId);
    form.set('client_secret', clientSecret);
  } else {
    const enc = (s) => encodeURIComponent(s); // RFC 6749 §2.3.1
    headers.Authorization = `Basic ${Buffer.from(`${enc(clientId)}:${enc(clientSecret)}`).toString('base64')}`;
  }
  try {
    const res = await axios.post(url.toString(), form.toString(), { headers, timeout: HTTP_TIMEOUT, maxRedirects: 0 });
    if (!res.data?.id_token) throw new SsoError('bad_token', 'The provider returned no id_token');
    return res.data;
  } catch (err) {
    if (err instanceof SsoError) throw err;
    throw new SsoError('exchange_failed', `Token exchange failed (${err.response?.data?.error || err.response?.status || err.code})`);
  }
}

async function verifyIdToken(idToken, { issuer, doc, clientId, nonce }) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded?.header) throw new SsoError('bad_token', 'Malformed id_token');
  const key = await signingKey(issuer, doc, decoded.header.kid);
  let claims;
  try {
    claims = jwt.verify(idToken, key, {
      algorithms: ID_TOKEN_ALGS, audience: clientId, issuer: [issuer, `${issuer}/`], clockTolerance: 60,
    });
  } catch (err) {
    throw new SsoError('bad_token', `id_token rejected: ${err.message}`);
  }
  if (!claims.nonce || !safeEqual(claims.nonce, nonce)) throw new SsoError('bad_token', 'Nonce mismatch');
  if (!claims.sub) throw new SsoError('bad_token', 'id_token has no subject');
  return claims;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ── Domains ──────────────────────────────────────────────

function emailDomain(email) {
  const at = String(email || '').lastIndexOf('@');
  return at > 0 ? String(email).slice(at + 1).trim().toLowerCase() : '';
}

/** Clean an admin-supplied domain list; throws on anything unusable. */
function cleanDomains(input) {
  const list = Array.isArray(input) ? input : String(input || '').split(/[\s,]+/);
  const out = [...new Set(list.map((d) => String(d).trim().toLowerCase().replace(/^@/, '')).filter(Boolean))];
  if (!out.length) throw new SsoError('bad_domains', 'Add at least one email domain');
  if (out.length > 20) throw new SsoError('bad_domains', 'At most 20 domains');
  for (const d of out) {
    if (!/^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) {
      throw new SsoError('bad_domains', `"${d}" is not a domain name`);
    }
    if (PUBLIC_EMAIL_DOMAINS.has(d)) throw new SsoError('bad_domains', `${d} is a public mail provider and cannot be routed to one organization`);
  }
  return out;
}

/** First/last name from standard claims, falling back to the mailbox name. */
function namesFrom(claims, email) {
  let first = claims.given_name || '';
  let last = claims.family_name || '';
  if (!first && claims.name) [first, ...last] = String(claims.name).trim().split(/\s+/);
  if (Array.isArray(last)) last = last.join(' ');
  if (!first) first = String(email).split('@')[0];
  return { firstName: String(first).slice(0, 60), lastName: String(last || '').slice(0, 60) };
}

module.exports = {
  SsoError, PUBLIC_EMAIL_DOMAINS,
  normalizeIssuer, discover, pkcePair, randomToken, authorizationUrl, exchangeCode, verifyIdToken,
  safeEqual, emailDomain, cleanDomains, namesFrom,
  _internal: { isPrivateAddress, checkUrl, assertPublicHost, metaCache },
};
