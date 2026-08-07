// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Multi-Tenant Middleware
// Injects organizationId into req for tenant-scoped queries
// ADMIN users can see all orgs or filter by ?orgId=
// Non-admin users are locked to their own organization
// ═══════════════════════════════════════════════════════════

/**
 * Tenant context middleware — runs AFTER authenticate().
 * Sets req.organizationId (nullable) and req.tenantWhere (Prisma filter).
 *
 * For ADMIN:
 *   - If ?orgId= is provided, scope to that org
 *   - Otherwise, no org filter (sees all)
 *
 * For non-ADMIN:
 *   - Always scope to user's organizationId
 *   - If user has no org assigned, scope to null (sees nothing tenant-scoped)
 */
function tenantContext(req, res, next) {
  if (!req.user) return next();

  if (req.user.role === 'ADMIN') {
    // Admin can optionally filter by org
    const orgId = req.query.orgId || req.headers['x-organization-id'];
    if (orgId) {
      req.organizationId = orgId;
      req.tenantWhere = { organizationId: orgId };
    } else {
      req.organizationId = null; // null = see all
      req.tenantWhere = {}; // no filter
    }
  } else {
    // Non-admin: locked to their organization
    req.organizationId = req.user.organizationId || null;
    if (req.organizationId) {
      req.tenantWhere = { organizationId: req.organizationId };
    } else {
      // User has no org — show unscoped data (backward compat)
      req.tenantWhere = {};
    }
  }

  next();
}

/**
 * Helper: get the organizationId to use when creating records.
 * Returns the user's org, or the admin's selected org, or null.
 */
function getCreateOrgId(req) {
  if (req.user.role === 'ADMIN') {
    // Admin creating records: use explicit orgId from body/query/header, else user's own org
    return req.body.organizationId || req.query.orgId || req.headers['x-organization-id'] || req.user.organizationId || null;
  }
  return req.user.organizationId || null;
}

module.exports = { tenantContext, getCreateOrgId };
