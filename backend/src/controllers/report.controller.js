// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Report Controller
// ═══════════════════════════════════════════════════════════

const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/database');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');

// Helper: build raw SQL org filter fragment
function rawOrgFilter(tw, table = '') {
  const prefix = table ? `${table}.` : '';
  if (tw?.organizationId) {
    return Prisma.sql`AND ${Prisma.raw(`${prefix}"organizationId"`)} = ${tw.organizationId}`;
  }
  return Prisma.sql``;
}

// GET /api/v1/reports/incidents?period=7d|30d|90d
async function incidentReport(req, res, next) {
  try {
    const period = req.query.period || '30d';
    const days = parseInt(period) || 30;
    const since = new Date(Date.now() - days * 86400000);

    const tw = req.tenantWhere || {};
    const orgF = rawOrgFilter(tw);
    const [total, byPriority, byState, byCategory, bySource, createdOverTime, mttr] = await prisma.$transaction([
      prisma.incident.count({ where: { ...tw, createdAt: { gte: since } } }),
      prisma.incident.groupBy({ by: ['priority'], _count: true, where: { ...tw, createdAt: { gte: since } } }),
      prisma.incident.groupBy({ by: ['state'], _count: true, where: { ...tw, createdAt: { gte: since } } }),
      prisma.incident.groupBy({ by: ['category'], _count: true, where: { ...tw, createdAt: { gte: since } }, orderBy: { _count: { category: 'desc' } }, take: 10 }),
      prisma.incident.groupBy({ by: ['source'], _count: true, where: { ...tw, createdAt: { gte: since } } }),
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, COUNT(*)::int as count
        FROM "Incident"
        WHERE "createdAt" >= ${since} ${orgF}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      prisma.$queryRaw`
        SELECT
          priority,
          AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))/60)::int as avg_mttr_minutes,
          COUNT(*)::int as resolved_count
        FROM "Incident"
        WHERE "resolvedAt" IS NOT NULL AND "createdAt" >= ${since} ${orgF}
        GROUP BY priority
      `,
    ]);

    const slaCompliance = await prisma.$queryRaw`
      SELECT
        priority,
        COUNT(*)::int as total,
        COUNT(CASE WHEN "slaBreached" = false THEN 1 END)::int as met,
        ROUND(COUNT(CASE WHEN "slaBreached" = false THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as compliance_pct
      FROM "Incident"
      WHERE "createdAt" >= ${since} ${orgF}
      GROUP BY priority
    `;

    return success(res, {
      period: `${days}d`,
      since: since.toISOString(),
      total,
      byPriority,
      byState,
      byCategory,
      bySource,
      createdOverTime,
      mttr,
      slaCompliance,
    });
  } catch (err) { next(err); }
}

// GET /api/v1/reports/changes
async function changeReport(req, res, next) {
  try {
    const period = req.query.period || '30d';
    const days = parseInt(period) || 30;
    const since = new Date(Date.now() - days * 86400000);

    const tw = req.tenantWhere || {};
    const orgF = rawOrgFilter(tw);
    const [total, byType, byState, byRisk, successRate] = await prisma.$transaction([
      prisma.change.count({ where: { ...tw, createdAt: { gte: since } } }),
      prisma.change.groupBy({ by: ['type'], _count: true, where: { ...tw, createdAt: { gte: since } } }),
      prisma.change.groupBy({ by: ['state'], _count: true, where: { ...tw, createdAt: { gte: since } } }),
      prisma.change.groupBy({ by: ['riskLevel'], _count: true, where: { ...tw, createdAt: { gte: since } } }),
      prisma.$queryRaw`
        SELECT
          COUNT(*)::int as total_completed,
          COUNT(CASE WHEN "closureCode" = 'SUCCESSFUL' THEN 1 END)::int as successful,
          ROUND(COUNT(CASE WHEN "closureCode" = 'SUCCESSFUL' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as success_rate
        FROM "Change"
        WHERE state = 'CLOSED' AND "createdAt" >= ${since} ${orgF}
      `,
    ]);

    return success(res, { period: `${days}d`, total, byType, byState, byRisk, successRate });
  } catch (err) { next(err); }
}

// GET /api/v1/reports/team-performance
async function teamPerformanceReport(req, res, next) {
  try {
    const period = req.query.period || '30d';
    const days = parseInt(period) || 30;
    const since = new Date(Date.now() - days * 86400000);

    const tw = req.tenantWhere || {};
    const orgFTeam = rawOrgFilter(tw, 't');
    const orgFInc = rawOrgFilter(tw, 'i');
    const teamStats = await prisma.$queryRaw`
      SELECT
        t.name as team_name,
        COUNT(DISTINCT i.id)::int as incident_count,
        COUNT(DISTINCT CASE WHEN i.state IN ('RESOLVED', 'CLOSED') THEN i.id END)::int as resolved_count,
        AVG(CASE WHEN i."resolvedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM (i."resolvedAt" - i."createdAt"))/60 END)::int as avg_mttr_minutes,
        ROUND(COUNT(DISTINCT CASE WHEN i."slaBreached" = false THEN i.id END)::numeric / NULLIF(COUNT(DISTINCT i.id), 0) * 100, 1) as sla_compliance
      FROM "Team" t
      LEFT JOIN "Incident" i ON i."assignmentGroupId" = t.id AND i."createdAt" >= ${since} ${orgFInc}
      WHERE 1=1 ${orgFTeam}
      GROUP BY t.id, t.name
      ORDER BY incident_count DESC
    `;

    return success(res, { period: `${days}d`, teams: teamStats });
  } catch (err) { next(err); }
}

// GET /api/v1/reports/executive-summary
async function executiveSummary(req, res, next) {
  try {
    const now = new Date();
    const last30d = new Date(Date.now() - 30 * 86400000);
    const last7d  = new Date(Date.now() - 7 * 86400000);

    const tw = req.tenantWhere || {};
    const orgF = rawOrgFilter(tw);
    const [
      totalIncidents30d, openIncidents, p1Count, slaBreached,
      totalChanges30d, totalProblems, firingAlerts,
      mttrResult, slaResult, changeSuccessResult,
    ] = await prisma.$transaction([
      prisma.incident.count({ where: { ...tw, createdAt: { gte: last30d } } }),
      prisma.incident.count({ where: { ...tw, state: { in: ['NEW', 'IN_PROGRESS', 'ESCALATED'] } } }),
      prisma.incident.count({ where: { ...tw, priority: 'P1', createdAt: { gte: last7d } } }),
      prisma.incident.count({ where: { ...tw, slaBreached: true, createdAt: { gte: last30d } } }),
      prisma.change.count({ where: { ...tw, createdAt: { gte: last30d } } }),
      prisma.problem.count({ where: { ...tw, state: { in: ['NEW', 'INVESTIGATION', 'RCA_IN_PROGRESS', 'KNOWN_ERROR'] } } }),
      prisma.alert.count({ where: { ...tw, status: 'FIRING' } }),
      prisma.$queryRaw`
        SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))/60)::int as avg_mttr
        FROM "Incident"
        WHERE "resolvedAt" IS NOT NULL AND "createdAt" >= ${last30d} ${orgF}
      `,
      prisma.$queryRaw`
        SELECT
          ROUND(COUNT(CASE WHEN "slaBreached" = false THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1)::float as pct
        FROM "Incident"
        WHERE "createdAt" >= ${last30d} ${orgF}
      `,
      prisma.$queryRaw`
        SELECT
          ROUND(COUNT(CASE WHEN "closureCode" = 'SUCCESSFUL' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1)::float as pct
        FROM "Change"
        WHERE state = 'CLOSED' AND "createdAt" >= ${last30d} ${orgF}
      `,
    ]);

    const avgMttrMinutes = mttrResult[0]?.avg_mttr ?? null;
    const avgMttrFormatted = avgMttrMinutes != null
      ? `${Math.floor(avgMttrMinutes / 60)}h ${avgMttrMinutes % 60}m`
      : null;

    return success(res, {
      generatedAt: now.toISOString(),
      totalIncidents:    totalIncidents30d,
      currentlyOpen:     openIncidents,
      p1Last7Days:       p1Count,
      slaBreached30d:    slaBreached,
      totalChanges:      totalChanges30d,
      openProblems:      totalProblems,
      firingAlerts,
      avgMttrMinutes,
      avgMttr:           avgMttrFormatted,
      slaCompliancePct:  slaResult[0]?.pct ?? null,
      changeSuccessPct:  changeSuccessResult[0]?.pct ?? null,
      // keep nested shape for backwards compat
      incidents: {
        last30Days: totalIncidents30d, currentlyOpen: openIncidents,
        p1Last7Days: p1Count, slaBreached30d: slaBreached,
      },
      changes:   { last30Days: totalChanges30d },
      problems:  { openProblems: totalProblems },
      alerts:    { currentlyFiring: firingAlerts },
    });
  } catch (err) { next(err); }
}

// GET /api/v1/reports/incident-trend?period=7d|30d|90d
async function incidentTrend(req, res, next) {
  try {
    const period = req.query.period || '30d';
    const days   = parseInt(period) || 30;
    const since  = new Date(Date.now() - days * 86400000);

    const tw = req.tenantWhere || {};
    const orgF = rawOrgFilter(tw);
    const [dailyCounts, mttrByDay, slaByPriority, changesByType] = await prisma.$transaction([
      prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE("createdAt"), 'Mon DD') as day,
          COUNT(*)::int as incidents,
          COUNT(CASE WHEN state IN ('RESOLVED','CLOSED') THEN 1 END)::int as resolved
        FROM "Incident"
        WHERE "createdAt" >= ${since} ${orgF}
        GROUP BY DATE("createdAt")
        ORDER BY DATE("createdAt") ASC
      `,
      prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE("resolvedAt"), 'Mon DD') as day,
          AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))/60)::int as mttr
        FROM "Incident"
        WHERE "resolvedAt" IS NOT NULL AND "resolvedAt" >= ${since} ${orgF}
        GROUP BY DATE("resolvedAt")
        ORDER BY DATE("resolvedAt") ASC
      `,
      prisma.$queryRaw`
        SELECT
          priority,
          ROUND(
            COUNT(CASE WHEN "slaBreached" = false THEN 1 END)::numeric
            / NULLIF(COUNT(*), 0) * 100, 1
          )::float as compliance
        FROM "Incident"
        WHERE "createdAt" >= ${since} ${orgF}
        GROUP BY priority
        ORDER BY priority ASC
      `,
      prisma.change.groupBy({ by: ['type'], _count: true, where: { ...tw, createdAt: { gte: since } } }),
    ]);

    const colorMap = { NORMAL: '#4F46E5', STANDARD: '#059669', EMERGENCY: '#DC2626' };
    const changeData = changesByType.map((c) => ({
      name: c.type.charAt(0) + c.type.slice(1).toLowerCase(),
      value: c._count,
      color: colorMap[c.type] || '#78716C',
    }));

    const slaData = ['P1', 'P2', 'P3', 'P4'].map((p) => {
      const found = slaByPriority.find((s) => s.priority === p);
      return { priority: p, compliance: found ? Number(found.compliance) : 100, target: 95 };
    });

    return success(res, {
      period: `${days}d`,
      dailyCounts,
      mttrTrend:     mttrByDay,
      slaCompliance: slaData,
      changesByType: changeData,
    });
  } catch (err) { next(err); }
}

module.exports = { incidentReport, changeReport, teamPerformanceReport, executiveSummary, incidentTrend };
