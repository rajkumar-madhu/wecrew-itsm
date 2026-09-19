// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Multi-Tenant Middleware
// Injects organizationId into req for tenant-scoped queries
// Platform admins can see all orgs or filter by ?orgId=
// Everyone else — including a self-registered org ADMIN — is locked to their own organization
// ═══════════════════════════════════════════════════════════

// Matches no row. Keyed on organizationId (not id) so spreading it into a
// where-clause cannot clobber, or be clobbered by, a caller's own id filter.
const NO_TENANT = Object.freeze({ organizationId: Object.freeze({ in: [] }) });

/** ADMIN role alone is not enough: cross-org access needs the platform flag. */
function isPlatformAdmin(user) {
  return !!user && user.role === 'ADMIN' && user.isPlatformAdmin === true;
}

/**
 * Scope for a user who may not leave their own organization. The org header
 * and ?orgId= are ignored. A user with no organization sees nothing
 * tenant-scoped — never everything.
 */
function lockToOwnOrg(req) {
  req.organizationId = req.user.organizationId || null;
  req.tenantWhere = req.organizationId ? { organizationId: req.organizationId } : NO_TENANT;
}

/**
 * Tenant context middleware — runs AFTER authenticate().
 * Sets req.organizationId (nullable) and req.tenantWhere (Prisma filter).
 *
 * For platform admins:
 *   - If ?orgId= is provided, scope to that org
 *   - Otherwise, no org filter (sees all)
 *
 * For everyone else:
 *   - Always scope to user's organizationId
 *   - If user has no org assigned, match nothing
 */
function tenantContext(req, res, next) {
  if (!req.user) return next();

  if (isPlatformAdmin(req.user)) {
    // Platform admin can optionally filter by org
    const orgId = req.query.orgId || req.headers['x-organization-id'];
    if (orgId) {
      req.organizationId = orgId;
      req.tenantWhere = { organizationId: orgId };
    } else {
      req.organizationId = null; // null = see all
      req.tenantWhere = {}; // no filter
    }
  } else {
    lockToOwnOrg(req);
  }

  next();
}

/**
 * Helper: get the organizationId to use when creating records.
 * Returns the user's org, or the platform admin's selected org, or null.
 */
function getCreateOrgId(req) {
  if (isPlatformAdmin(req.user)) {
    // Platform admin creating records: use explicit orgId from body/query/header, else own org
    return req.body.organizationId || req.query.orgId || req.headers['x-organization-id'] || req.user.organizationId || null;
  }
  return req.user.organizationId || null;
}

// ── Helpers for handlers that touch a record by id ───────
// Use these instead of hand-rolled checks so every handler agrees on scope.

/** Where-fragment for the caller's scope: `{ ...scopedWhere(req), id }`. Never `{}` by accident. */
function scopedWhere(req) {
  return req.tenantWhere || NO_TENANT;
}

/**
 * Is an already-loaded record (carrying organizationId) inside the caller's
 * scope? A platform admin viewing all orgs sees everything; everyone else only
 * their resolved org; a caller scoped to nothing sees nothing.
 * Answer 404, not 403, when this is false — don't confirm another tenant's ids.
 */
function inScope(req, record) {
  if (!record) return false;
  const tw = scopedWhere(req);
  if (!('organizationId' in tw)) return true; // platform admin, all orgs
  return typeof tw.organizationId === 'string' && record.organizationId === tw.organizationId;
}

/** Drop keys a request body must never set on update (tenant move, key rewrite). */
function stripTenantFields(body) {
  const { id: _id, organizationId: _org, ...rest } = body || {};
  return rest;
}

module.exports = {
  tenantContext, getCreateOrgId, isPlatformAdmin, lockToOwnOrg, NO_TENANT,
  scopedWhere, inScope, stripTenantFields,
};
