// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — CMDB / Asset Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { paginate, paginationMeta, success, error } = require('../utils/helpers');
const { Prisma } = require('@prisma/client');
const { getCreateOrgId, scopedWhere, inScope, stripTenantFields } = require('../middleware/tenant');

// Only real columns may be written from a request body — never nested relation
// writes (e.g. `incidents: { connect: [...] }`) or the tenant key.
const CI_COLUMNS = new Set(Prisma.dmmf.datamodel.models.find((m) => m.name === 'ConfigurationItem').fields
  .filter((f) => f.kind !== 'object').map((f) => f.name));
function pickCIColumns(body) {
  return Object.fromEntries(Object.entries(stripTenantFields(body))
    .filter(([k]) => CI_COLUMNS.has(k) && !['createdAt', 'updatedAt'].includes(k)));
}

// ownerId / supportGroupId must point at a user / team in the CI's own org.
// Unchanged values (a form re-sending the current owner) are not re-checked.
async function checkCIRefs(data, organizationId, current = {}) {
  if (data.ownerId && data.ownerId !== current.ownerId && !await prisma.user.findFirst({ where: { id: data.ownerId, organizationId }, select: { id: true } })) {
    return 'ownerId must be a user in this organization';
  }
  if (data.supportGroupId && data.supportGroupId !== current.supportGroupId && !await prisma.team.findFirst({ where: { id: data.supportGroupId, organizationId }, select: { id: true } })) {
    return 'supportGroupId must be a team in this organization';
  }
  return null;
}

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
    if (!inScope(req, asset)) return error(res, 'Asset not found', 404);
    return success(res, asset);
  } catch (err) { next(err); }
}

// POST /api/v1/assets
async function createAsset(req, res, next) {
  try {
    const organizationId = getCreateOrgId(req);
    // Default the owner to the creator only when the creator belongs to that org
    // (a platform admin creating in a customer org is not a valid owner there).
    const defaultOwner = req.user.organizationId === organizationId ? req.user.id : undefined;
    const data = { ...pickCIColumns(req.body), ownerId: req.body.ownerId || defaultOwner, organizationId };
    const refError = await checkCIRefs(data, organizationId);
    if (refError) return error(res, refError, 400);
    const asset = await prisma.configurationItem.create({ data, include: INCLUDE_LIST });

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
    if (!inScope(req, existing)) return error(res, 'Asset not found', 404);

    const data = pickCIColumns(req.body);
    const refError = await checkCIRefs(data, existing.organizationId, existing);
    if (refError) return error(res, refError, 400);
    const asset = await prisma.configurationItem.update({
      where: { id: existing.id }, data, include: INCLUDE_LIST,
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
    const existing = await prisma.configurationItem.findFirst({
      where: { ...scopedWhere(req), id: req.params.id }, select: { id: true },
    });
    if (!existing) return error(res, 'Asset not found', 404);
    await prisma.configurationItem.delete({ where: { id: existing.id } });
    return success(res, { message: 'Asset deleted' });
  } catch (err) { next(err); }
}

// GET /api/v1/assets/stats
async function getAssetStats(req, res, next) {
  try {
    const tw = scopedWhere(req);
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
