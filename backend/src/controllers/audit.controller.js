// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Audit Log Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error } = require('../utils/helpers');
const { isPlatformAdmin, NO_TENANT } = require('../middleware/tenant');

// AuditLog has no organizationId, so scope by the acting user's org. Platform
// staff see everything; an org ADMIN/MANAGER sees only entries made by users of
// their own org (system and staff entries stay platform-only); no org → nothing.
function auditScope(req) {
  if (isPlatformAdmin(req.user)) return {};
  if (!req.user.organizationId) return { user: { is: { organizationId: NO_TENANT.organizationId } } };
  return { user: { is: { organizationId: req.user.organizationId } } };
}

// GET /api/v1/audit
async function listAuditLogs(req, res, next) {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      entityType,
      userId,
      startDate,
      endDate,
      search,
    } = req.query;

    const skip = (Math.max(1, +page) - 1) * +limit;
    const take = Math.min(200, Math.max(1, +limit));

    const where = { ...auditScope(req) };

    if (action && action !== 'ALL') {
      where.action = { contains: action, mode: 'insensitive' };
    }
    if (entityType && entityType !== 'ALL') {
      where.entityType = entityType;
    }
    if (userId && userId !== 'ALL') {
      where.userId = userId;
    }
    if (startDate) {
      where.createdAt = { ...(where.createdAt || {}), gte: new Date(startDate) };
    }
    if (endDate) {
      where.createdAt = { ...(where.createdAt || {}), lte: new Date(endDate) };
    }
    if (search) {
      where.OR = [
        { entityType: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / take);
    return success(res, logs, 200, {
      page: +page,
      limit: take,
      total,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/audit/entity-types
async function getEntityTypes(req, res, next) {
  try {
    const types = await prisma.auditLog.findMany({
      where: auditScope(req),
      select: { entityType: true },
      distinct: ['entityType'],
      orderBy: { entityType: 'asc' },
    });
    return success(res, types.map(t => t.entityType));
  } catch (err) {
    next(err);
  }
}

module.exports = { listAuditLogs, getEntityTypes };
