// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Dashboard / Stats Controller
// Multi-Tenant: All queries scoped by req.tenantWhere
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success } = require('../utils/helpers');

// GET /api/v1/dashboard/stats
async function getDashboardStats(req, res, next) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const tw = req.tenantWhere || {};

    const [
      openIncidents, p1Active, p2Active, slaBreached,
      firingAlerts, activeChanges,
      incidentsByState, incidentsByPriority, incidentsByCategory,
      recentIncidents, recentAlerts,
      totalIncidents, resolvedLast7d,
    ] = await prisma.$transaction([
      prisma.incident.count({ where: { ...tw, state: { in: ['NEW', 'IN_PROGRESS', 'ON_HOLD', 'ESCALATED'] } } }),
      prisma.incident.count({ where: { ...tw, priority: 'P1', state: { in: ['NEW', 'IN_PROGRESS', 'ESCALATED'] } } }),
      prisma.incident.count({ where: { ...tw, priority: 'P2', state: { in: ['NEW', 'IN_PROGRESS', 'ESCALATED'] } } }),
      prisma.incident.count({ where: { ...tw, slaBreached: true, state: { notIn: ['CLOSED', 'CANCELLED'] } } }),
      prisma.alert.count({ where: { ...tw, status: 'FIRING' } }),
      prisma.change.count({ where: { ...tw, state: { in: ['IMPLEMENTING', 'SCHEDULED'] } } }),

      prisma.incident.groupBy({ by: ['state'], where: { ...tw }, _count: true }),
      prisma.incident.groupBy({ by: ['priority'], where: { ...tw }, _count: true }),
      prisma.incident.groupBy({ by: ['category'], _count: true, where: { ...tw, category: { not: null } }, orderBy: { _count: { category: 'desc' } }, take: 10 }),

      prisma.incident.findMany({
        where: { ...tw, createdAt: { gte: sevenDaysAgo } },
        select: { id: true, number: true, shortDescription: true, state: true, priority: true, createdAt: true, assignedTo: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' }, take: 10,
      }),
      prisma.alert.findMany({
        where: { ...tw, status: 'FIRING' },
        select: { id: true, name: true, severity: true, status: true, firedAt: true, configItem: { select: { name: true } } },
        orderBy: { firedAt: 'desc' }, take: 10,
      }),

      prisma.incident.count({ where: { ...tw } }),
      prisma.incident.count({ where: { ...tw, state: 'RESOLVED', resolvedAt: { gte: sevenDaysAgo } } }),
    ]);

    // Calculate SLA compliance %
    const totalOpenAndRecent = await prisma.incident.count({ where: { ...tw, createdAt: { gte: sevenDaysAgo } } });
    const breachedRecent = await prisma.incident.count({ where: { ...tw, slaBreached: true, createdAt: { gte: sevenDaysAgo } } });
    const slaCompliance = totalOpenAndRecent > 0 ? Math.round(((totalOpenAndRecent - breachedRecent) / totalOpenAndRecent) * 100) : 100;

    return success(res, {
      kpi: { openIncidents, p1Active, p2Active, slaBreached, firingAlerts, activeChanges, slaCompliance, totalIncidents, resolvedLast7d },
      charts: { incidentsByState, incidentsByPriority, incidentsByCategory },
      tables: { recentIncidents, recentAlerts },
    });
  } catch (err) { next(err); }
}

// GET /api/v1/dashboard/incident-trend
async function getIncidentTrend(req, res, next) {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const tw = req.tenantWhere || {};
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const start = new Date(date.setHours(0, 0, 0, 0));
      const end = new Date(date.setHours(23, 59, 59, 999));
      const counts = await prisma.incident.groupBy({
        by: ['priority'],
        where: { ...tw, createdAt: { gte: start, lte: end } },
        _count: true,
      });
      result.push({ date: start.toISOString().slice(0, 10), counts });
    }
    return success(res, result);
  } catch (err) { next(err); }
}

// GET /api/v1/dashboard/sla-compliance
async function getSLACompliance(req, res, next) {
  try {
    const priorities = ['P1', 'P2', 'P3', 'P4'];
    const tw = req.tenantWhere || {};
    const compliance = {};

    for (const p of priorities) {
      const total = await prisma.incident.count({ where: { ...tw, priority: p, state: { in: ['RESOLVED', 'CLOSED'] } } });
      const breached = await prisma.incident.count({ where: { ...tw, priority: p, slaBreached: true, state: { in: ['RESOLVED', 'CLOSED'] } } });
      compliance[p] = { total, breached, met: total - breached, percentage: total > 0 ? Math.round(((total - breached) / total) * 100) : 100 };
    }

    return success(res, compliance);
  } catch (err) { next(err); }
}

module.exports = { getDashboardStats, getIncidentTrend, getSLACompliance };
