// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Global Search Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');

// GET /api/v1/search?q=...&type=all|incidents|changes|problems|assets|alerts
async function globalSearch(req, res, next) {
  try {
    const { q, type = 'all', limit = 20 } = req.query;
    if (!q || q.length < 2) return error(res, 'Search query must be at least 2 characters', 400);

    const take = Math.min(parseInt(limit, 10) || 20, 50);
    const searchMode = { contains: q, mode: 'insensitive' };
    const results = {};

    const tw = req.tenantWhere || {};

    // Incidents
    if (type === 'all' || type === 'incidents') {
      results.incidents = await prisma.incident.findMany({
        where: {
          ...tw,
          OR: [
            { number: searchMode },
            { shortDescription: searchMode },
            { description: searchMode },
          ],
        },
        select: {
          id: true, number: true, shortDescription: true, priority: true, state: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
      });
    }

    // Changes
    if (type === 'all' || type === 'changes') {
      results.changes = await prisma.change.findMany({
        where: {
          ...tw,
          OR: [
            { number: searchMode },
            { shortDescription: searchMode },
            { description: searchMode },
          ],
        },
        select: {
          id: true, number: true, shortDescription: true, type: true, state: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
      });
    }

    // Problems
    if (type === 'all' || type === 'problems') {
      results.problems = await prisma.problem.findMany({
        where: {
          ...tw,
          OR: [
            { number: searchMode },
            { shortDescription: searchMode },
            { description: searchMode },
          ],
        },
        select: {
          id: true, number: true, shortDescription: true, priority: true, state: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
      });
    }

    // Assets (Configuration Items)
    if (type === 'all' || type === 'assets') {
      results.assets = await prisma.configurationItem.findMany({
        where: {
          ...tw,
          OR: [
            { name: searchMode },
            { description: searchMode },
            { ipAddress: searchMode },
            { hostname: searchMode },
          ],
        },
        select: {
          id: true, name: true, type: true, status: true, ipAddress: true, description: true,
        },
        orderBy: { name: 'asc' },
        take,
      });
    }

    // Alerts
    if (type === 'all' || type === 'alerts') {
      results.alerts = await prisma.alert.findMany({
        where: {
          ...tw,
          OR: [
            { name: searchMode },
            { description: searchMode },
            { alertId: searchMode },
          ],
        },
        select: {
          id: true, name: true, severity: true, status: true, source: true, firedAt: true,
        },
        orderBy: { firedAt: 'desc' },
        take,
      });
    }

    // Total count across all types
    const totalCount = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    return success(res, { query: q, totalCount, results });
  } catch (err) { next(err); }
}

module.exports = { globalSearch };
