// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Keycloak single sign-on (OpenID Connect)
//
// Authorization-code flow with PKCE, state and nonce. The browser never
// sees Keycloak's tokens: the API exchanges the code server-side, verifies
// the ID token against the realm's published keys, then hands the SPA a
// 60-second, single-use token in the URL fragment (never sent to servers or
// logs) that it trades for a normal WeCrew session.
//
// SSO only signs in users who already exist here — it never creates one,
// so nobody can land in an organisation by owning a matching Keycloak login.
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

const STATE_TTL = '10m';
const HANDOFF_TTL_SECONDS = 60;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

const kc = () => config.keycloak || {};

function isEnabled() {
  const { url, realm, clientId, clientSecret } = kc();
  return !!(url && realm && clientId && clientSecret);
}

function redirectUri() {
  return process.env.KEYCLOAK_REDIRECT_URI
    || `${String(config.frontendUrl || '').replace(/\/+$/, '')}/api/v1/auth/sso/callback`;
}

const deriveKey = (label) => crypto.createHash('sha256').update(`${process.env.JWT_SECRET}:${label}`).digest();
const b64url = (buf) => buf.toString('base64url');

// ── Realm metadata + signing keys (cached) ──────────────

let discoveryCache = null;
let jwksCache = null;

async function getJson(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Keycloak ${res.status}: ${body.error_description || body.error || url}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function discovery() {
  if (discoveryCache && discoveryCache.expires > Date.now()) return discoveryCache.doc;
  const { url, realm } = kc();
  const doc = await getJson(`${url.replace(/\/+$/, '')}/realms/${encodeURIComponent(realm)}/.well-known/openid-configuration`);
  discoveryCache = { doc, expires: Date.now() + DISCOVERY_TTL_MS };
  return doc;
}

async function signingKey(kid) {
  const find = () => jwksCache?.keys.find((k) => k.kid === kid && k.use !== 'enc');
  if (!find()) jwksCache = await getJson((await discovery()).jwks_uri); // refetch on unknown kid (key rotation)
  const jwk = find();
  if (!jwk) throw new Error('ID token signed with an unknown key');
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

// ── Step 1: send the browser to Keycloak ────────────────

/** → { url, stateCookie } — put stateCookie in an httpOnly cookie. */
async function startLogin() {
  const doc = await discovery();
  const state = b64url(crypto.randomBytes(24));
  const nonce = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());

  const url = new URL(doc.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: kc().clientId,
    redirect_uri: redirectUri(),
    scope: 'openid email profile',
    state, nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

  const stateCookie = jwt.sign({ state, nonce, verifier }, deriveKey('sso-state'), { expiresIn: STATE_TTL });
  return { url: url.toString(), stateCookie };
}

// ── Step 2: Keycloak sends the browser back with a code ─

function sameString(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Verify the round trip and the ID token. → { email, emailVerified, subject } */
async function finishLogin({ code, state, stateCookie }) {
  let saved;
  try { saved = jwt.verify(String(stateCookie || ''), deriveKey('sso-state')); } catch { saved = null; }
  if (!saved || !state || !sameString(saved.state, state)) throw Object.assign(new Error('state mismatch'), { reason: 'state' });

  const doc = await discovery();
  const tokens = await getJson(doc.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code || ''),
      redirect_uri: redirectUri(),
      client_id: kc().clientId,
      client_secret: kc().clientSecret,
      code_verifier: saved.verifier,
    }),
  });
  if (!tokens.id_token) throw new Error('Keycloak returned no ID token');

  const header = jwt.decode(tokens.id_token, { complete: true })?.header;
  if (!header?.kid) throw new Error('ID token has no key id');
  const claims = jwt.verify(tokens.id_token, await signingKey(header.kid), {
    algorithms: ['RS256', 'RS384', 'RS512', 'PS256', 'ES256'],
    issuer: doc.issuer,
    audience: kc().clientId,
    clockTolerance: 30,
  });
  if (!claims.nonce || !sameString(claims.nonce, saved.nonce)) throw Object.assign(new Error('nonce mismatch'), { reason: 'state' });

  return {
    email: typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : null,
    emailVerified: claims.email_verified === true,
    subject: claims.sub,
  };
}

// ── Step 3: hand the SPA a one-time token ───────────────

// Single API replica (maxSurge: 0), so an in-memory spent list is enough to
// make each hand-off single-use within its 60 s life.
const spent = new Map();

function signHandoff(userId) {
  return jwt.sign({ id: userId, purpose: 'sso-handoff', jti: b64url(crypto.randomBytes(16)) },
    deriveKey('sso-handoff'), { expiresIn: HANDOFF_TTL_SECONDS });
}

/** → userId once per token, else null. */
function redeemHandoff(token) {
  let decoded;
  try { decoded = jwt.verify(String(token || ''), deriveKey('sso-handoff')); } catch { return null; }
  if (decoded.purpose !== 'sso-handoff' || !decoded.jti) return null;
  const now = Date.now();
  for (const [jti, exp] of spent) if (exp < now) spent.delete(jti);
  if (spent.has(decoded.jti)) return null;
  spent.set(decoded.jti, decoded.exp * 1000);
  return decoded.id;
}

function _resetForTests() { discoveryCache = null; jwksCache = null; spent.clear(); }

module.exports = {
  isEnabled, redirectUri, startLogin, finishLogin, signHandoff, redeemHandoff, _resetForTests,
};
