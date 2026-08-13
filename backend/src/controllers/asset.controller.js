// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — CMDB / Asset Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { paginate, paginationMeta, success, error } = require('../utils/helpers');
const { getCreateOrgId } = require('../middleware/tenant');

const INCLUDE_LIST = {
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
  supportGroup: { select: { id: true, name: true } },
  _count: { select: { alerts: true, incidents: true } },
};

const INCLUDE_DETAIL = {
  ...INCLUDE_LIST,
  incidents: { select: { id: true, number: true, shortDescription: true, state: true, priority: true }, orderBy: { createdAt: 'desc' }, take: 10 },
  alerts: { where: { status: 'FIRING' }, orderBy: { firedAt: 'desc' }, take: 10 },
  changes: { include: { change: { select: { id: true, number: true, shortDescription: true, state: true } } }, take: 10 },
  activities: { include: { user: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
};

// GET /api/v1/assets
async function listAssets(req, res, next) {
  try {
    const { type, status, search, ownerId, supportGroupId, sortBy, sortOrder } = req.query;
    const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);

    const where = {};
    Object.assign(where, req.tenantWhere);
    if (type) where.type = type;
    if (status) where.status = status;
    if (ownerId) where.ownerId = ownerId;
    if (supportGroupId) where.supportGroupId = supportGroupId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { hostname: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = sortBy ? { [sortBy]: sortOrder || 'asc' } : { name: 'asc' };

    const [assets, total] = await prisma.$transaction([
      prisma.configurationItem.findMany({ where, include: INCLUDE_LIST, orderBy, skip, take }),
      prisma.configurationItem.count({ where }),
    ]);

    return success(res, assets, 200, paginationMeta(total, page, limit));
  } catch (err) { next(err); }
}

// GET /api/v1/assets/:id
async function getAsset(req, res, next) {
  try {
    const asset = await prisma.configurationItem.findUnique({ where: { id: req.params.id }, include: INCLUDE_DETAIL });
    if (!asset) return error(res, 'Asset not found', 404);
    if (req.tenantWhere?.organizationId && asset.organizationId !== req.tenantWhere.organizationId) return error(res, 'Asset not found', 404);
    return success(res, asset);
  } catch (err) { next(err); }
}

// POST /api/v1/assets
async function createAsset(req, res, next) {
  try {
    const asset = await prisma.configurationItem.create({
      data: { ...req.body, ownerId: req.body.ownerId || req.user.id, organizationId: getCreateOrgId(req) },
      include: INCLUDE_LIST,
    });

    await prisma.activity.create({
      data: { action: 'CREATED', description: `CI ${asset.name} created`, userId: req.user.id, configItemId: asset.id },
    });

    return success(res, asset, 201);
  } catch (err) { next(err); }
}

// PATCH /api/v1/assets/:id
async function updateAsset(req, res, next) {
  try {
    const existing = await prisma.configurationItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Asset not found', 404);
    if (req.tenantWhere?.organizationId && existing.organizationId !== req.tenantWhere.organizationId) return error(res, 'Asset not found', 404);

    const asset = await prisma.configurationItem.update({
      where: { id: req.params.id }, data: req.body, include: INCLUDE_LIST,
    });

    await prisma.activity.create({
      data: { action: 'UPDATED', description: `CI ${asset.name} updated`, userId: req.user.id, configItemId: asset.id },
    });

    return success(res, asset);
  } catch (err) { next(err); }
}

// DELETE /api/v1/assets/:id
async function deleteAsset(req, res, next) {
  try {
    await prisma.configurationItem.delete({ where: { id: req.params.id } });
    return success(res, { message: 'Asset deleted' });
  } catch (err) { next(err); }
}

// GET /api/v1/assets/stats
async function getAssetStats(req, res, next) {
  try {
    const tw = req.tenantWhere || {};
    const in90days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const [byType, byStatus, total, monitoringCount, liveCount, eolCount, warrantyCount, costAgg, topRiskAssets] =
      await prisma.$transaction([
        prisma.configurationItem.groupBy({ by: ['type'], where: { ...tw }, _count: true }),
        prisma.configurationItem.groupBy({ by: ['status'], where: { ...tw }, _count: true }),
        prisma.configurationItem.count({ where: { ...tw } }),
        prisma.configurationItem.count({ where: { ...tw, monitoringEnabled: true } }),
        prisma.configurationItem.count({ where: { ...tw, status: 'LIVE' } }),
        prisma.configurationItem.count({ where: { ...tw, endOfLife: { lte: in90days } } }),
        prisma.configurationItem.count({ where: { ...tw, warrantyExpiry: { lte: in90days } } }),
        prisma.configurationItem.aggregate({ where: { ...tw }, _sum: { purchaseCost: true, monthlyCost: true } }),
        prisma.configurationItem.findMany({
          where: { ...tw },
          orderBy: { alerts: { _count: 'desc' } },
          take: 20,
          select: {
            id: true, name: true, type: true, status: true, hostname: true,
            endOfLife: true, warrantyExpiry: true, monitoringEnabled: true, organizationId: true,
            _count: { select: { alerts: true, incidents: true } },
          },
        }),
      ]);

    return success(res, {
      total, byType, byStatus,
      liveCount,
      monitoringCoverage: monitoringCount,
      eolWarnings: eolCount,
      warrantyWarnings: warrantyCount,
      costTotals: { purchaseCost: costAgg._sum.purchaseCost, monthlyCost: costAgg._sum.monthlyCost },
      topRiskAssets,
    });
  } catch (err) { next(err); }
}

module.exports = { listAssets, getAsset, createAsset, updateAsset, deleteAsset, getAssetStats };
