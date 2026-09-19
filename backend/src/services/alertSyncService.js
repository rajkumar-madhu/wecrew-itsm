// ═══════════════════════════════════════════════════════════
// Argus ITSM — Pull-Based Alert Sync Service
// Periodically SSH into remote orgs, fetch firing alerts from
// Prometheus, and create Alert + Incident records in the DB.
// Solves: remote orgs can't push webhooks to Argus (DNS/NAT issues)
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { emitToAll, emitToTeam, emitToUser } = require('../config/socket');
const { generateIncidentNumber, calculateSLATargetTimes } = require('../utils/helpers');
const { resolveInstanceToConfigItem } = require('../utils/cmdbResolver');
const { buildIncidentFromAlert } = require('../controllers/alert.controller');
const { getRemoteFiringAlerts } = require('./k8sService');
const agentPipeline = require('./agentPipeline');
const logger = require('../utils/logger');

// ── System User Cache ────────────────────────────────────
let _systemUserId = null;
async function getSystemUserId() {
  if (_systemUserId) return _systemUserId;
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isPlatformAdmin: true, status: 'ACTIVE' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (admin) _systemUserId = admin.id;
  return _systemUserId;
}

// ── Team & Assignee Resolution ────────────────────────────
// Routing rules based on Finspot team structure:
//   Network Team  — network devices (Dell/Aruba/Arista/FortiGate/Router/Huawei/SNMP/Ping)
//                   and hardware (iLO/iDRAC/vNIC/Windows/Linux hardware)
//   DevOps Team   — application (LE pods, D4), infrastructure (K8s), monitoring
//   DB Team       — all database issues (MySQL/PostgreSQL/MongoDB/Redis/Neo4j)
//   LE Team       — LE-specific application support
const CATEGORY_TEAM_PATTERNS = {
  'Network':            ['Network'],
  'Hardware':           ['Network'],
  'Storage':            ['Network'],
  'Security':           ['Network'],
  'Database':           ['DB', 'DBA', 'Database'],
  'Application':        ['DevOps', 'LE'],
  'Cloud Infrastructure': ['DevOps'],
  'Infrastructure':     ['DevOps'],
  'Monitoring':         ['DevOps'],
  'Other':              ['DevOps'],
};

async function resolveTeamAndAssignee(configItemId, category, organizationId) {
  let assignmentGroupId = null;
  let assignedToId = null;

  if (configItemId) {
    try {
      const ci = await prisma.configurationItem.findUnique({
        where: { id: configItemId },
        select: { supportGroupId: true },
      });
      if (ci?.supportGroupId) assignmentGroupId = ci.supportGroupId;
    } catch (e) { logger.warn('[alertSync] CMDB lookup failed: %s', e.message); }
  }

  if (!assignmentGroupId && category) {
    const patterns = CATEGORY_TEAM_PATTERNS[category] || CATEGORY_TEAM_PATTERNS['Other'];
    const orgWhere = organizationId ? { organizationId } : {};
    for (const pat of patterns) {
      const team = await prisma.team.findFirst({
        where: { ...orgWhere, name: { contains: pat, mode: 'insensitive' } },
        select: { id: true, managerId: true },
      });
      if (team) {
        assignmentGroupId = team.id;
        assignedToId = team.managerId || null;
        break;
      }
    }
  }

  if (assignmentGroupId && !assignedToId) {
    try {
      const now = new Date();
      const schedule = await prisma.onCallSchedule.findFirst({
        where: { teamId: assignmentGroupId, startTime: { lte: now }, endTime: { gte: now } },
        select: { userId: true },
        orderBy: { startTime: 'desc' },
      });
      if (schedule?.userId) assignedToId = schedule.userId;
    } catch (e) { logger.warn('[alertSync] On-call lookup failed: %s', e.message); }
    if (!assignedToId) {
      try {
        const team = await prisma.team.findUnique({
          where: { id: assignmentGroupId },
          select: { managerId: true },
        });
        if (team?.managerId) assignedToId = team.managerId;
      } catch (e) { logger.warn('[alertSync] Team manager lookup failed: %s', e.message); }
    }
  }

  return { assignmentGroupId, assignedToId };
}

// ── Fetch firing alerts via direct HTTP (Basic Auth or Bearer token) ─
async function fetchDirectAlerts(prometheusUrl, cfg) {
  const axios = require('axios');
  let headers = {};
  if (cfg.apiKey) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  } else if (cfg.prometheusUsername && cfg.prometheusPassword) {
    const b64 = Buffer.from(`${cfg.prometheusUsername}:${cfg.prometheusPassword}`).toString('base64');
    headers.Authorization = `Basic ${b64}`;
  }
  try {
    const { data } = await axios.get(`${prometheusUrl.replace(/\/+$/, '')}/api/v1/alerts`, { headers, timeout: 15000 });
    if (data.status === 'success') {
      return { alerts: (data.data?.alerts || []).filter(a => a.state === 'firing') };
    }
    return { alerts: [], fetchError: `Prometheus returned status: ${data.status}` };
  } catch (err) {
    return { alerts: [], fetchError: err.message };
  }
}

// ── Process a single org's alerts ────────────────────────
async function processOrgAlerts(integration) {
  const org = integration.organization;
  if (!org) return { created: 0, resolved: 0, skipped: 0, ok: false };

  let config = {};
  try { config = JSON.parse(integration.config || '{}'); } catch (e) { logger.warn('[alertSync] Failed to parse integration config: %s', e.message); }

  const accessMethod = config.accessMethod || 'ssh';
  let firingAlerts, fetchError;

  if (accessMethod === 'direct') {
    if (!config.prometheusUrl) {
      logger.warn(`[AlertSync] Skipping ${org.name} — direct method but no prometheusUrl configured`);
      return { created: 0, resolved: 0, skipped: 0, ok: false };
    }
    const result = await fetchDirectAlerts(config.prometheusUrl, config);
    firingAlerts = result.alerts;
    fetchError = result.fetchError;
  } else {
    // SSH method (default)
    const serverIp = config.serverIp || org.serverIp;
    const sshPort = parseInt(config.sshPort) || 4422;
    const sshUser = config.sshUser || 'finadmin';
    const promPort = parseInt(config.promPort) || 30000;
    if (!serverIp || serverIp === 'local') return { created: 0, resolved: 0, skipped: 0, ok: true };
    const result = await getRemoteFiringAlerts(serverIp, sshPort, promPort, sshUser);
    firingAlerts = result.alerts;
    fetchError = result.fetchError;
  }

  let created = 0, resolved = 0, skipped = 0;

  try {
    // Fetch/network failed — do NOT auto-resolve (server may just be temporarily unreachable)
    if (fetchError) {
      logger.warn(`[AlertSync] Skipping ${org.name} — fetch failed: ${fetchError.substring(0, 100)}`);
      return { created: 0, resolved: 0, skipped: 0, ok: false };
    }

    if (!firingAlerts || firingAlerts.length === 0) {
      // Remote confirmed zero firing alerts — safe to auto-resolve
      const result = await prisma.alert.updateMany({
        where: { organizationId: org.id, status: 'FIRING', source: 'PROMETHEUS' },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
      if (result.count > 0) {
        resolved += result.count;
        logger.info(`[AlertSync] ${org.name}: no firing alerts remotely — auto-resolved ${result.count} stale alerts`);
      }
      return { created, resolved, skipped, ok: true };
    }

    const stillFiringIds = new Set();

    for (const a of firingAlerts) {
      const alertName = a.labels?.alertname || 'Unknown';
      const instance = a.labels?.instance || '';
      // Stable alertId — never use Date.now() (creates unique ID every cycle, breaks dedup)
      const stableKey = instance || [a.labels?.job, a.labels?.namespace, a.labels?.pod, a.labels?.service].filter(Boolean).join(':') || 'global';
      const alertId = `${alertName}:${stableKey}`;
      stillFiringIds.add(alertId);

      // Primary dedup: exact alertId match
      const existing = await prisma.alert.findFirst({ where: { alertId, organizationId: org.id } });
      if (existing) { skipped++; continue; }

      // Secondary dedup: same name+instance currently FIRING (catches old Date.now()-based IDs)
      if (instance) {
        const dupeByName = await prisma.alert.findFirst({
          where: { organizationId: org.id, name: alertName, status: 'FIRING', alertId: { startsWith: `${alertName}:${instance}` } },
        });
        if (dupeByName) { skipped++; stillFiringIds.add(dupeByName.alertId); continue; }
      }

      const isRecoveryAlert = /Ok[-.]|ok[-.]|normal.state|able.to.access/i.test(alertName);
      const severity = (a.labels?.severity || 'warning').toUpperCase();
      const configItemId = await resolveInstanceToConfigItem(instance);

      const alert = await prisma.alert.create({
        data: {
          alertId,
          name: alertName,
          severity: severity === 'CRITICAL' ? 'CRITICAL' : severity === 'WARNING' ? 'WARNING' : 'INFO',
          status: isRecoveryAlert ? 'RESOLVED' : 'FIRING',
          source: 'PROMETHEUS',
          description: a.annotations?.description || a.annotations?.summary || '',
          metric: alertName,
          currentValue: a.annotations?.value || a.value || null,
          threshold: a.annotations?.threshold || null,
          labels: JSON.stringify(a.labels || {}),
          annotations: JSON.stringify(a.annotations || {}),
          firedAt: a.activeAt ? new Date(a.activeAt) : new Date(),
          ...(isRecoveryAlert && { resolvedAt: new Date() }),
          ...(configItemId && { configItemId }),
          organizationId: org.id,
        },
      });
      created++;

      if (isRecoveryAlert) {
        const basePattern = alertName.replace(/Ok[-.]?.*/, '').replace(/ok[-.]?.*/, '');
        if (basePattern.length > 2) {
          const instanceIp = instance.split(':')[0];
          await prisma.alert.updateMany({
            where: {
              status: 'FIRING', organizationId: org.id,
              AND: [
                { name: { contains: basePattern, mode: 'insensitive' } },
                ...(instanceIp ? [{ name: { contains: instanceIp } }] : []),
              ],
            },
            data: { status: 'RESOLVED', resolvedAt: new Date() },
          });
        }
        emitToAll('alert:resolved', { id: alert.id, name: alert.name });
        continue;
      }

      emitToAll('alert:fired', { id: alert.id, name: alert.name, severity: alert.severity });

      // Auto-create incident for CRITICAL and WARNING
      if (alert.severity === 'CRITICAL' || alert.severity === 'WARNING') {
        try {
          const incData = await buildIncidentFromAlert(alert);
          const incNumber = await generateIncidentNumber();
          const createdById = await getSystemUserId();
          const priority = incData.urgency === 'CRITICAL' ? 'P1' : incData.urgency === 'HIGH' ? 'P2' : 'P3';
          const slaTargets = calculateSLATargetTimes(priority, new Date());
          const { assignmentGroupId, assignedToId } = await resolveTeamAndAssignee(incData.configItemId, incData.category, org.id);

          const incident = await prisma.incident.create({
            data: {
              number: incNumber,
              shortDescription: incData.shortDescription,
              description: incData.description,
              state: 'NEW',
              impact: incData.impact,
              urgency: incData.urgency,
              priority,
              source: 'PROMETHEUS',
              sourceAlertId: alert.alertId,
              sourceAlertName: alert.name,
              category: incData.category || null,
              subcategory: incData.subcategory || null,
              ...slaTargets,
              ...(createdById && { createdById }),
              ...(assignmentGroupId && { assignmentGroupId }),
              ...(assignedToId && { assignedToId }),
              organizationId: org.id,
            },
          });

          emitToAll('incident:created', { id: incident.id, number: incident.number, priority: incident.priority });
          if (assignmentGroupId) emitToTeam(assignmentGroupId, 'incident:assigned', { id: incident.id, number: incident.number, priority });
          if (assignedToId) emitToUser(assignedToId, 'incident:assigned-to-you', { id: incident.id, number: incident.number, priority });
          logger.info(`[AlertSync] Auto-created incident ${incident.number} (${priority}) from ${alert.severity} alert ${alert.name} [${org.name}]`);
        } catch (incErr) {
          logger.error(`[AlertSync] Auto-incident creation failed for ${alert.name} [${org.name}]: ${incErr.message}`);
        }
      }

      agentPipeline.processAlert(alert, a.labels || {}).catch(pipeErr => {
        logger.error(`[AlertSync] Agent pipeline failed for ${alert.name}: ${pipeErr.message}`);
      });
    }

    // Auto-resolve alerts that are no longer firing remotely
    const dbFiringAlerts = await prisma.alert.findMany({
      where: { organizationId: org.id, status: 'FIRING', source: 'PROMETHEUS' },
      select: { id: true, alertId: true, name: true },
    });
    for (const dbAlert of dbFiringAlerts) {
      if (!stillFiringIds.has(dbAlert.alertId)) {
        await prisma.alert.update({ where: { id: dbAlert.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
        resolved++;
        emitToAll('alert:resolved', { id: dbAlert.id, name: dbAlert.name });
      }
    }

    return { created, resolved, skipped, ok: true };
  } catch (orgErr) {
    logger.warn(`[AlertSync] Failed for ${org.name} (${serverIp}): ${orgErr.message}`);
    return { created: 0, resolved: 0, skipped: 0, ok: false };
  }
}

// ── Main Sync Function ────────────────────────────────────
let _syncRunning = false;

async function syncRemoteAlerts() {
  // Guard: skip if previous cycle hasn't finished (prevents parallel SSH storms)
  if (_syncRunning) {
    logger.warn('[AlertSync] Previous cycle still running — skipping this tick');
    return;
  }
  _syncRunning = true;
  const startTime = Date.now();

  try {
    const promIntegrations = await prisma.integration.findMany({
      where: { type: 'PROMETHEUS', status: 'ACTIVE' },
      include: {
        organization: { select: { id: true, name: true, slug: true, environment: true, serverIp: true } },
      },
    });

    if (promIntegrations.length === 0) return;

    // Run orgs in parallel batches of 4 (cuts cycle from ~186s to ~30s)
    const CONCURRENCY = 4;
    const results = [];
    for (let i = 0; i < promIntegrations.length; i += CONCURRENCY) {
      const batch = promIntegrations.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(intg => processOrgAlerts(intg)));
      results.push(...batchResults);
    }

    const totalCreated = results.reduce((s, r) => s + r.created, 0);
    const totalResolved = results.reduce((s, r) => s + r.resolved, 0);
    const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
    const orgsOk = results.filter(r => r.ok).length;
    const orgsFailed = results.filter(r => !r.ok).length;

    const elapsed = Date.now() - startTime;
    logger.info(`[AlertSync] Cycle complete in ${elapsed}ms — ${orgsOk} orgs OK, ${orgsFailed} failed, ${totalCreated} alerts created, ${totalResolved} resolved, ${totalSkipped} skipped`);
  } finally {
    _syncRunning = false;
  }
}

module.exports = { syncRemoteAlerts };
