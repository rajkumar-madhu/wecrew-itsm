// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Organization (Multi-Tenant) Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error, paginate, paginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');

// GET /api/v1/organizations — List all orgs (ADMIN only)
async function listOrganizations(req, res, next) {
  try {
    const { search, environment, isActive } = req.query;
    const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (environment) where.environment = environment;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [orgs, total] = await prisma.$transaction([
      prisma.organization.findMany({
        where, skip, take,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { users: true, incidents: true, teams: true, configurationItems: true, alerts: true },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return success(res, orgs, 200, paginationMeta(total, page, limit));
  } catch (err) { next(err); }
}

// GET /api/v1/organizations/:id
async function getOrganization(req, res, next) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { users: true, incidents: true, changes: true, problems: true, teams: true, configurationItems: true, alerts: true },
        },
      },
    });
    if (!org) return error(res, 'Organization not found', 404);
    return success(res, org);
  } catch (err) { next(err); }
}

// POST /api/v1/organizations (ADMIN only)
async function createOrganization(req, res, next) {
  try {
    const { name, slug, environment, serverIp, fqdn, description } = req.body;
    const org = await prisma.organization.create({
      data: { name, slug, environment: environment || 'PROD', serverIp, fqdn, description },
    });
    logger.info(`Organization created: ${name} (${slug}) by ${req.user.email}`);
    return success(res, org, 201);
  } catch (err) { next(err); }
}

// PATCH /api/v1/organizations/:id (ADMIN only)
async function updateOrganization(req, res, next) {
  try {
    const { name, environment, serverIp, fqdn, description, isActive } = req.body;
    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: { name, environment, serverIp, fqdn, description, isActive },
    });
    return success(res, org);
  } catch (err) { next(err); }
}

module.exports = { listOrganizations, getOrganization, createOrganization, updateOrganization };
