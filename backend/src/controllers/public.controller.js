// ═══════════════════════════════════════════════════════════
// WeCrew Ops ITSM — Public Site Controller
// POST /api/v1/public/leads   (unauthenticated)
//
// Serves the public marketing site's pilot and demo forms. Every other
// controller in this codebase sits behind `authenticate`; this one does not, so
// it is written defensively: nothing from the request reaches the database
// unvalidated or unbounded, no record is organization-scoped, and failures never
// echo internal detail back to an anonymous caller.
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');

// Field caps. Postgres TEXT is unbounded, and this endpoint is open to the
// internet — without these a single request could store megabytes.
const LIMITS = {
  name: 120,
  // RFC 5321 caps a forward-path at 254 octets. Truncating to anything less and
  // then validating would mangle a long-but-legitimate address into a
  // "looks incomplete" rejection, so email is length-checked, never trimmed.
  email: 254,
  company: 160,
  phone: 40,
  teamSize: 40,
  message: 4000,
  userAgent: 400,
};

const INTERESTS = { pilot: 'PILOT', demo: 'DEMO' };

// Deliberately loose: this catches typos, it does not adjudicate RFC 5322.
// Anything stricter rejects real addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim, collapse newlines out of single-line fields, and cap length. */
function clean(value, max, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  const collapsed = multiline ? value : value.replace(/[\r\n]+/g, ' ');
  return collapsed.trim().slice(0, max);
}

/**
 * The client sits behind nginx and the host Traefik, so req.ip is a proxy
 * address unless trust proxy is set. Prefer the first X-Forwarded-For hop and
 * cap it — the header is attacker-controlled, so it is stored for abuse triage
 * only and must never be used for authorization.
 */
function sourceIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = typeof forwarded === 'string' ? forwarded.split(',')[0] : null;
  return clean(first || req.ip || '', 60);
}

// POST /api/v1/public/leads
async function createLead(req, res) {
  try {
    const body = req.body || {};

    const name = clean(body.name, LIMITS.name);
    // Cap generously (not at LIMITS.email) so an over-length address is caught
    // by the explicit check below and told the truth, rather than being trimmed
    // into something that merely looks malformed.
    const email = clean(body.email, LIMITS.email * 4).toLowerCase();
    const company = clean(body.company, LIMITS.company);
    const phone = clean(body.phone, LIMITS.phone);
    const teamSize = clean(body.teamSize, LIMITS.teamSize);
    const message = clean(body.message, LIMITS.message, { multiline: true });
    const interest = INTERESTS[String(body.interest || '').toLowerCase()];

    // One message per failure, phrased for the person filling in the form.
    if (!name) return error(res, 'Please tell us your name.', 400);
    if (!email) return error(res, 'Please give us an email address to reply to.', 400);
    if (email.length > LIMITS.email) return error(res, 'That email address is too long.', 400);
    if (!EMAIL_RE.test(email)) return error(res, 'That email address looks incomplete.', 400);
    if (!company) return error(res, 'Please tell us which organisation this is for.', 400);
    if (!interest) return error(res, 'Unrecognised request type.', 400);

    const lead = await prisma.lead.create({
      data: {
        name,
        email,
        company,
        phone: phone || null,
        interest,
        teamSize: teamSize || null,
        message: message || null,
        sourceIp: sourceIp(req),
        userAgent: clean(req.headers['user-agent'], LIMITS.userAgent),
      },
      // Return the id only. An anonymous caller has no business reading back
      // the stored row.
      select: { id: true },
    });

    logger.info('[Public] lead %s received (%s) from %s', lead.id, interest, company);
    return success(res, { id: lead.id }, 201);
  } catch (err) {
    // The reason stays in the log; the caller gets a generic failure and an
    // email fallback from the UI.
    logger.error('[Public] createLead failed: %s', err.message);
    return error(res, 'We could not record your request. Please email us instead.', 500);
  }
}

module.exports = { createLead };
