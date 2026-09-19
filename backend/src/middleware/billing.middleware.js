// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Billing enforcement
//
// 402 Payment Required is the wire signal for "subscription lapsed".
// The frontend keys its upgrade prompt off this status, so do not
// change it to 403 — 403 is indistinguishable from an RBAC denial.
// ═══════════════════════════════════════════════════════════

const { getAccessState } = require('../services/billing.service');
const { isPlatformAdmin } = require('./tenant');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Billing and auth must stay reachable while locked out, or the customer
// cannot reach the page that takes their money.
const EXEMPT = [/^\/billing/, /^\/auth/, /^\/webhooks/, /^\/public/, /^\/status/];

async function enforceWriteAccess(req, res, next) {
  try {
    if (!WRITE_METHODS.has(req.method)) return next();
    if (EXEMPT.some((re) => re.test(req.path))) return next();

    const orgId = req.user && req.user.organizationId;
    if (!orgId) return next(); // no tenant — nothing to bill

    const state = await getAccessState(orgId);
    if (!state.isReadOnly) return next();

    return res.status(402).json({
      success: false,
      error: state.status === 'TRIALING'
        ? 'Your 20-day trial has ended. Subscribe to continue making changes.'
        : 'Your subscription is inactive. Renew to continue making changes.',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  } catch (err) { return next(err); }
}

async function enforceSeatLimit(req, res, next) {
  try {
    // Count seats in the org the user is being added TO: register() lets a
    // platform admin target another org via the body.
    const orgId = req.user && (isPlatformAdmin(req.user)
      ? req.body.organizationId || req.user.organizationId
      : req.user.organizationId);
    if (!orgId) return next();

    // register() defaults a missing role to VIEWER, so count it the same way.
    const role = (req.body && req.body.role) || 'VIEWER';
    if (role === 'VIEWER') return next(); // viewers are free and uncapped

    const state = await getAccessState(orgId);
    if (state.seatLimit == null) return next();

    if (state.seatsUsed >= state.seatLimit) {
      return res.status(402).json({
        success: false,
        error: `Your plan includes ${state.seatLimit} agent seats and all are in use. `
             + 'Upgrade, or add the user as a Viewer (Viewers are free and unlimited).',
        code: 'SEAT_LIMIT_REACHED',
      });
    }
    return next();
  } catch (err) { return next(err); }
}

module.exports = { enforceWriteAccess, enforceSeatLimit };
