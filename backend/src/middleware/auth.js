// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Authentication & Authorization Middleware
// ═══════════════════════════════════════════════════════════

const { verifyAccessToken } = require('../utils/jwt');
const { prisma } = require('../config/database');
const { PERMISSIONS } = require('../config/constants');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken;
    if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, organizationId: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, error: 'User inactive or not found' });
    }

    req.user = user;

    // ── Tenant context (inline) ──────────────────────────
    // Super-admin (ADMIN + no org): sees all, optionally filter by header/query
    // Org-admin (ADMIN + has org): default to own org, can switch via header/query
    // Non-ADMIN: locked to their organization
    if (user.role === 'ADMIN') {
      const headerOrgId = req.query.orgId || req.headers['x-organization-id'];
      if (user.organizationId) {
        // Org-admin: default to own org, header can override
        const effectiveOrgId = headerOrgId || user.organizationId;
        req.organizationId = effectiveOrgId;
        req.tenantWhere = { organizationId: effectiveOrgId };
      } else {
        // Super-admin (no org): sees all unless header specifies
        req.organizationId = headerOrgId || null;
        req.tenantWhere = headerOrgId ? { organizationId: headerOrgId } : {};
      }
    } else {
      req.organizationId = user.organizationId || null;
      req.tenantWhere = user.organizationId ? { organizationId: user.organizationId } : {};
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

function checkPermission(resource, action) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const perms = PERMISSIONS[req.user.role];
    if (!perms || !perms[resource]) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const allowed = perms[resource];
    const actionMap = { read: 'r', create: 'c', update: 'u', delete: 'd' };
    if (!allowed.includes(actionMap[action] || action)) {
      return res.status(403).json({ success: false, error: 'Permission denied for this action' });
    }
    next();
  };
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken;
  if (!token) return next();
  try {
    req.user = verifyAccessToken(token);
  } catch { /* ignore */ }
  next();
}

module.exports = { authenticate, authorize, checkPermission, optionalAuth };
