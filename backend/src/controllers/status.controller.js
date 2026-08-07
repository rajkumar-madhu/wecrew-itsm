const { prisma } = require('../config/database');

// ── Public status page — no authentication required ──────────────────────────
async function getOrgStatus(req, res) {
  try {
    const { orgSlug } = req.params;

    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true, name: true, slug: true, fqdn: true, environment: true },
    });

    if (!org) return res.status(404).json({ success: false, error: 'Status page not found' });

    const orgId = org.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Parallel queries — all public/safe data
    const [activeIncidents, components, recentAlerts] = await Promise.all([
      // Active incidents (not resolved or closed)
      prisma.incident.findMany({
        where: { organizationId: orgId, state: { notIn: ['RESOLVED', 'CLOSED'] } },
        select: {
          id: true, number: true, title: true, priority: true,
          state: true, createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // CMDB components — APPLICATION, DATABASE, K8S_CLUSTER, SERVER types
      prisma.configurationItem.findMany({
        where: {
          organizationId: orgId,
          type: { in: ['APPLICATION', 'DATABASE', 'K8S_CLUSTER', 'SERVER'] },
        },
        select: {
          id: true, name: true, type: true, status: true,
          alerts: {
            where: { status: 'FIRING' },
            select: { id: true, severity: true },
          },
        },
        orderBy: { name: 'asc' },
      }),

      // Alert history for 30-day uptime calculation
      prisma.alert.findMany({
        where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo } },
        select: { id: true, severity: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // ── Component status calculation ───────────────────────────────────────────
    const componentStatus = components.map((c) => {
      const firing = c.alerts || [];
      const hasCritical = firing.some((a) => a.severity === 'CRITICAL');
      const hasWarning = firing.some((a) => a.severity === 'WARNING');

      let compStatus = 'operational';
      if (c.status === 'MAINTENANCE') compStatus = 'maintenance';
      else if (hasCritical) compStatus = 'down';
      else if (hasWarning) compStatus = 'degraded';

      return {
        id: c.id,
        name: c.name,
        type: c.type,
        status: compStatus,
        firingCount: firing.length,
      };
    });

    // ── Overall status ─────────────────────────────────────────────────────────
    const hasDown = componentStatus.some((c) => c.status === 'down')
      || activeIncidents.some((i) => i.priority === 'P1');
    const hasDegraded = componentStatus.some((c) => c.status === 'degraded')
      || activeIncidents.some((i) => i.priority === 'P2' || i.priority === 'P3');

    let overallStatus = 'operational';
    if (hasDown) overallStatus = 'major_outage';
    else if (hasDegraded) overallStatus = 'degraded';

    // ── 30-day uptime history (one bucket per calendar day) ───────────────────
    const dayHistory = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayAlerts = recentAlerts.filter((a) => {
        const d = new Date(a.createdAt);
        return d >= dayStart && d < dayEnd;
      });

      const criticalCount = dayAlerts.filter((a) => a.severity === 'CRITICAL').length;
      const warningCount = dayAlerts.filter((a) => a.severity === 'WARNING').length;

      let dayStatus = 'operational';
      if (criticalCount > 0) dayStatus = 'outage';
      else if (warningCount > 0) dayStatus = 'degraded';

      dayHistory.push({
        date: dayStart.toISOString().split('T')[0],
        status: dayStatus,
        criticalCount,
        warningCount,
        totalAlerts: dayAlerts.length,
      });
    }

    // Uptime % = days with no critical alerts in the last 30 days
    const operationalDays = dayHistory.filter((d) => d.status !== 'outage').length;
    const uptimePercent = ((operationalDays / 30) * 100).toFixed(2);

    // Duration helper (minutes since incident created)
    const withDuration = activeIncidents.map((i) => ({
      ...i,
      durationMinutes: Math.round((now - new Date(i.createdAt)) / 60000),
    }));

    res.json({
      success: true,
      data: {
        org: {
          name: org.name,
          slug: org.slug,
          fqdn: org.fqdn,
          environment: org.environment,
        },
        overallStatus,
        uptimePercent,
        components: componentStatus,
        activeIncidents: withDuration,
        dayHistory,
        lastUpdated: now.toISOString(),
      },
    });
  } catch (err) {
    console.error('[StatusPage]', err);
    res.status(500).json({ success: false, error: 'Failed to load status data' });
  }
}

module.exports = { getOrgStatus };
