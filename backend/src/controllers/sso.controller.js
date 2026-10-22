// ═══════════════════════════════════════════════════════════
// Argus ITSM — Single sign-on (OpenID Connect)
//
// Public:  POST /auth/sso/discover  { email } → does this domain use SSO?
//          GET  /auth/sso/start?email=…      → redirect to the org's IdP
//          GET  /auth/sso/callback           → IdP returns here
// Admin:   GET|PUT|DELETE /auth/sso/config, POST /auth/sso/config/test
//
// The callback never puts tokens in a URL: it opens a session, sets the
// httpOnly refresh cookie and redirects to /sso/callback, where the SPA
// trades the cookie for an access token via POST /auth/refresh.
// ═══════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const { config } = require('../config/env');
const { success, error } = require('../utils/helpers');
const { getCreateOrgId } = require('../middleware/tenant');
const { getAccessState } = require('../services/billing.service');
const { encryptSecret, decryptSecret } = require('../services/mfa.service');
const sso = require('../services/sso.service');
const { startSession } = require('./auth.controller');
const logger = require('../utils/logger');

const STATE_COOKIE = 'argus_sso';
const STATE_TTL_SEC = 10 * 60;
const ROLES = ['ADMIN', 'MANAGER', 'ENGINEER', 'OPERATOR', 'VIEWER', 'REQUESTER'];

const frontend = () => config.frontendUrl.replace(/\/+$/, '');
function redirectUri() {
  return process.env.SSO_REDIRECT_URI || `${frontend()}/api/v1/auth/sso/callback`;
}
function stateKey() {
  return crypto.createHash('sha256').update(`sso-state:${config.jwt.secret}`).digest();
}
function stateCookieOptions() {
  // Lax, not strict: the cookie has to come back on the IdP's top-level redirect
  return { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/api/v1/auth/sso', maxAge: STATE_TTL_SEC * 1000 };
}

async function configForEmail(email) {
  const domain = sso.emailDomain(email);
  if (!domain) return null;
  return prisma.ssoConfig.findFirst({ where: { enabled: true, domains: { has: domain } } });
}

// ── Public flow ──────────────────────────────────────────

async function discover(req, res, next) {
  try {
    const cfg = await configForEmail(req.body.email);
    if (!cfg) return success(res, { sso: false });
    const email = String(req.body.email).trim().toLowerCase();
    return success(res, { sso: true, enforced: cfg.enforce, startUrl: `/api/v1/auth/sso/start?email=${encodeURIComponent(email)}` });
  } catch (err) { return next(err); }
}

function failRedirect(res, code, detail) {
  if (detail) logger.warn(`[SSO] ${code}: ${detail}`);
  res.clearCookie(STATE_COOKIE, { path: '/api/v1/auth/sso' });
  return res.redirect(302, `${frontend()}/login?sso_error=${encodeURIComponent(code)}`);
}

async function start(req, res) {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    const cfg = await configForEmail(email);
    if (!cfg) return failRedirect(res, 'not_configured');
    const doc = await sso.discover(cfg.issuer);
    const state = sso.randomToken();
    const nonce = sso.randomToken();
    const { verifier, challenge } = sso.pkcePair();
    const ticket = jwt.sign({ o: cfg.organizationId, s: state, n: nonce, v: verifier }, stateKey(), { expiresIn: STATE_TTL_SEC });
    res.cookie(STATE_COOKIE, ticket, stateCookieOptions());
    return res.redirect(302, sso.authorizationUrl(doc, {
      clientId: cfg.clientId, redirectUri: redirectUri(), state, nonce, challenge, loginHint: email,
    }));
  } catch (err) {
    return failRedirect(res, err instanceof sso.SsoError ? err.code : 'start_failed', err.message);
  }
}

async function callback(req, res) {
  try {
    if (req.query.error) return failRedirect(res, 'idp_error', `${req.query.error}: ${req.query.error_description || ''}`);
    let ticket;
    try {
      ticket = jwt.verify(String(req.cookies?.[STATE_COOKIE] || ''), stateKey());
    } catch {
      return failRedirect(res, 'expired');
    }
    if (!req.query.code || !sso.safeEqual(req.query.state || '', ticket.s)) return failRedirect(res, 'state_mismatch');

    const cfg = await prisma.ssoConfig.findUnique({ where: { organizationId: ticket.o } });
    if (!cfg || !cfg.enabled) return failRedirect(res, 'not_configured');

    const doc = await sso.discover(cfg.issuer);
    const tokens = await sso.exchangeCode(doc, {
      clientId: cfg.clientId, clientSecret: decryptSecret(cfg.clientSecret),
      code: String(req.query.code), redirectUri: redirectUri(), verifier: ticket.v,
    });
    const claims = await sso.verifyIdToken(tokens.id_token, { issuer: cfg.issuer, doc, clientId: cfg.clientId, nonce: ticket.n });

    const email = String(claims.email || '').trim().toLowerCase();
    if (!email) return failRedirect(res, 'no_email', 'id_token has no email claim');
    if (claims.email_verified === false || claims.email_verified === 'false') return failRedirect(res, 'email_unverified', email);
    if (!cfg.domains.includes(sso.emailDomain(email))) return failRedirect(res, 'domain_not_allowed', email);

    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // The org's IdP speaks only for the org's own accounts, and never for platform staff
      if (user.organizationId !== cfg.organizationId) return failRedirect(res, 'wrong_organization', email);
      if (user.isPlatformAdmin) return failRedirect(res, 'use_password', email);
      if (user.status === 'INACTIVE') return failRedirect(res, 'inactive', email);
      if (user.ssoId && user.ssoId !== String(claims.sub)) return failRedirect(res, 'identity_mismatch', email);
    } else {
      if (!cfg.autoProvision) return failRedirect(res, 'not_provisioned', email);
      if (cfg.defaultRole !== 'VIEWER') {
        const seats = await getAccessState(cfg.organizationId);
        if (seats.seatLimit != null && seats.seatsUsed >= seats.seatLimit) return failRedirect(res, 'seat_limit', email);
      }
      user = await prisma.user.create({
        data: {
          email, ...sso.namesFrom(claims, email),
          // Unusable random password: this account signs in through the IdP
          password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
          role: cfg.defaultRole, organizationId: cfg.organizationId, status: 'ACTIVE',
          ssoProvider: 'oidc', ssoId: String(claims.sub),
        },
      });
      logger.info(`[SSO] Provisioned ${email} as ${cfg.defaultRole}`);
    }

    await startSession(req, res, user, { ssoProvider: 'oidc', ssoId: String(claims.sub) });
    res.clearCookie(STATE_COOKIE, { path: '/api/v1/auth/sso' });
    logger.info(`User logged in via SSO: ${email}`);
    return res.redirect(302, `${frontend()}/sso/callback`);
  } catch (err) {
    return failRedirect(res, err instanceof sso.SsoError ? err.code : 'callback_failed', err.message);
  }
}

// ── Admin configuration ──────────────────────────────────

function present(cfg) {
  return {
    configured: !!cfg,
    enabled: cfg?.enabled ?? false,
    issuer: cfg?.issuer ?? '',
    clientId: cfg?.clientId ?? '',
    hasClientSecret: !!cfg?.clientSecret,
    domains: cfg?.domains ?? [],
    defaultRole: cfg?.defaultRole ?? 'REQUESTER',
    autoProvision: cfg?.autoProvision ?? true,
    enforce: cfg?.enforce ?? false,
    redirectUri: redirectUri(),
  };
}

function orgOrFail(req, res) {
  const organizationId = getCreateOrgId(req);
  if (!organizationId) { error(res, 'Select an organization first', 400); return null; }
  return organizationId;
}

async function getConfig(req, res, next) {
  try {
    const organizationId = orgOrFail(req, res);
    if (!organizationId) return undefined;
    const cfg = await prisma.ssoConfig.findUnique({ where: { organizationId } });
    return success(res, present(cfg));
  } catch (err) { return next(err); }
}

async function putConfig(req, res, next) {
  try {
    const organizationId = orgOrFail(req, res);
    if (!organizationId) return undefined;
    const existing = await prisma.ssoConfig.findUnique({ where: { organizationId } });
    const b = req.body || {};

    let issuer; let domains;
    try {
      issuer = sso.normalizeIssuer(b.issuer);
      domains = sso.cleanDomains(b.domains);
    } catch (e) { return error(res, e.message, 400); }
    const clientId = String(b.clientId || '').trim();
    if (!clientId || clientId.length > 300) return error(res, 'Client ID is required', 400);
    const secret = typeof b.clientSecret === 'string' ? b.clientSecret.trim() : '';
    if (!secret && !existing) return error(res, 'Client secret is required', 400);
    if (secret.length > 1000) return error(res, 'Client secret is too long', 400);
    const defaultRole = b.defaultRole || 'REQUESTER';
    if (!ROLES.includes(defaultRole)) return error(res, 'Unknown default role', 400);
    // SSO can mint org admins only if an admin chooses that explicitly per user, never by default
    if (defaultRole === 'ADMIN') return error(res, 'New SSO users cannot default to Admin', 400);

    // A domain belongs to one organization only, and not one other tenants' users already use
    const clash = await prisma.ssoConfig.findFirst({
      where: { organizationId: { not: organizationId }, domains: { hasSome: domains } }, select: { id: true },
    });
    if (clash) return error(res, 'One of these domains is already used by another organization', 409);
    const foreignUser = await prisma.user.findFirst({
      where: {
        organizationId: { not: organizationId },
        OR: domains.map((d) => ({ email: { endsWith: `@${d}`, mode: 'insensitive' } })),
      },
      select: { id: true },
    });
    if (foreignUser) return error(res, 'Users of another organization have addresses at one of these domains', 409);

    const enabled = !!b.enabled;
    if (enabled) {
      try { await sso.discover(issuer, { fresh: true }); } catch (e) {
        return error(res, `Cannot enable: ${e.message}`, 400);
      }
    }

    const data = {
      enabled, issuer, clientId, domains, defaultRole,
      autoProvision: b.autoProvision !== false,
      enforce: enabled && !!b.enforce,
      ...(secret ? { clientSecret: encryptSecret(secret) } : {}),
    };
    const saved = existing
      ? await prisma.ssoConfig.update({ where: { organizationId }, data })
      : await prisma.ssoConfig.create({ data: { ...data, organizationId } });
    logger.info(`[SSO] Config saved for org ${organizationId} by ${req.user.email} (enabled=${saved.enabled}, enforce=${saved.enforce})`);
    return success(res, present(saved));
  } catch (err) { return next(err); }
}

async function deleteConfig(req, res, next) {
  try {
    const organizationId = orgOrFail(req, res);
    if (!organizationId) return undefined;
    await prisma.ssoConfig.deleteMany({ where: { organizationId } });
    return success(res, present(null));
  } catch (err) { return next(err); }
}

// Checks the issuer's discovery document; doesn't save anything.
async function testConfig(req, res, next) {
  try {
    const organizationId = orgOrFail(req, res);
    if (!organizationId) return undefined;
    let issuer = req.body?.issuer;
    if (!issuer) issuer = (await prisma.ssoConfig.findUnique({ where: { organizationId }, select: { issuer: true } }))?.issuer;
    try {
      const doc = await sso.discover(sso.normalizeIssuer(issuer), { fresh: true });
      return success(res, { ok: true, issuer: doc.issuer, authorizationEndpoint: doc.authorization_endpoint });
    } catch (e) {
      return success(res, { ok: false, error: e.message });
    }
  } catch (err) { return next(err); }
}

module.exports = { discover, start, callback, getConfig, putConfig, deleteConfig, testConfig, _internal: { present, redirectUri } };
