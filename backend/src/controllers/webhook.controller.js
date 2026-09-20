// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Webhook Controller (Inbound)
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { emitToAll, emitToTeam, emitToUser } = require('../config/socket');
const { success, error, generateIncidentNumber, calculateSLATargetTimes } = require('../utils/helpers');
const logger = require('../utils/logger');
const slackService = require('../services/slackService');
const crypto = require('crypto');
// config/env exports { validateEnv, config } — the old `const config = require(...)`
// made config.slack always undefined, so Slack signatures were never checked.
const { config } = require('../config/env');
const { resolveInstanceToConfigItem } = require('../utils/cmdbResolver');
const { buildIncidentFromAlert } = require('./alert.controller');
const agentPipeline = require('../services/agentPipeline');
const { authenticateAlertWebhook } = require('../middleware/alertWebhookAuth');

// ── Slack request signing ───────────────────────────────────
// Every Slack request must carry a valid v0 signature over the raw body
// (captured by the urlencoded parser in server.js) and a fresh timestamp.
function verifySlackRequest(req) {
  const secret = config.slack && config.slack.signingSecret;
  if (!secret) return { status: 503, error: 'Slack is not configured' };
  const signature = req.headers['x-slack-signature'];
  const timestamp = Number(req.headers['x-slack-request-timestamp']);
  if (!signature || !timestamp) return { status: 401, error: 'Missing Slack signature' };
  if (Math.abs(Date.now() / 1000 - timestamp) > 60 * 5) return { status: 401, error: 'Stale Slack request' };
  const expected = `v0=${crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${req.rawBody || ''}`).digest('hex')}`;
  const a = Buffer.from(expected); const b = Buffer.from(String(signature));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { status: 401, error: 'Invalid signature' };
  return null;
}

// ── Blocked/Offboarded Client IPs ───────────────────────────
// Orgs that have been removed from the platform — their Prometheus/Alertmanager
// may still send webhooks. Reject them cleanly instead of creating orphan alerts.
const BLOCKED_SOURCE_IPS = new Set([
  '209.38.127.79', // Terv-pro-tech (offboarded)
]);

function getSourceIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .split(',')[0].trim().replace('::ffff:', '');
}

// ── System User Cache (for auto-created incidents) ──────────
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

// ── Team & Assignee Resolution (3-tier lookup) ──────────────
// Tier 1: CMDB supportGroup → Tier 2: category → team name pattern → Tier 3: on-call user
// Routing rules based on Finspot team structure:
//   Network Team  — all network devices (Dell/Aruba/Arista/FortiGate/Router/Huawei/SNMP/Ping)
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

  // Tier 1: CMDB support group
  if (configItemId) {
    try {
      const ci = await prisma.configurationItem.findUnique({
        where: { id: configItemId },
        select: { supportGroupId: true },
      });
      if (ci?.supportGroupId) assignmentGroupId = ci.supportGroupId;
    } catch (e) { logger.warn('[resolveAssignment] CMDB lookup failed: %s', e.message); }
  }

  // Tier 2: Category-to-team pattern match within org
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

  // Tier 3: On-call user from resolved team
  if (assignmentGroupId && !assignedToId) {
    try {
      const now = new Date();
      const schedule = await prisma.onCallSchedule.findFirst({
        where: {
          teamId: assignmentGroupId,
          startTime: { lte: now },
          endTime: { gte: now },
        },
        select: { userId: true },
        orderBy: { startTime: 'desc' },
      });
      if (schedule?.userId) assignedToId = schedule.userId;
    } catch (e) { logger.warn('[resolveAssignment] On-call lookup failed: %s', e.message); }
    // Fallback: team manager
    if (!assignedToId) {
      try {
        const team = await prisma.team.findUnique({
          where: { id: assignmentGroupId },
          select: { managerId: true },
        });
        if (team?.managerId) assignedToId = team.managerId;
      } catch (e) { logger.warn('[resolveAssignment] Team manager lookup failed: %s', e.message); }
    }
  }

  return { assignmentGroupId, assignedToId };
}

// POST /api/v1/webhooks/alertmanager
async function alertmanagerWebhook(req, res, next) {
  try {
    const sourceIp = getSourceIp(req);
    if (BLOCKED_SOURCE_IPS.has(sourceIp)) {
      logger.info('[Webhook] Blocked alertmanager webhook from offboarded IP: %s', sourceIp);
      return res.status(200).json({ success: true, message: 'received' }); // 200 so alertmanager stops retrying
    }

    const auth = await authenticateAlertWebhook(req);
    if (auth.error) return error(res, auth.error, 401);

    const { alerts: incoming, status, groupLabels } = req.body;
    if (!Array.isArray(incoming)) return error(res, 'Invalid Alertmanager payload', 400);

    const results = [];
    for (const a of incoming) {
      const alertId = a.labels?.alertname + ':' + (a.labels?.instance || a.fingerprint || Date.now());
      // Resolve tenant BEFORE any lookup — never find by alertId alone.
      let organizationId = auth.orgId;
      const instanceIp = (a.labels?.instance || '').split(':')[0];
      if (auth.legacy && !organizationId) {
        const qOrgId = req.query.orgId || req.query.org_id;
        const qOrgSlug = req.query.orgSlug || req.query.org_slug;
        if (qOrgId) {
          const org = await prisma.organization.findUnique({ where: { id: qOrgId } });
          if (org) organizationId = org.id;
        }
        if (!organizationId && qOrgSlug) {
          const org = await prisma.organization.findUnique({ where: { slug: qOrgSlug } });
          if (org) organizationId = org.id;
        }
        const orgSlug = a.labels?.org_slug || a.labels?.organization || a.labels?.client || '';
        if (!organizationId && orgSlug) {
          const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
          if (org) organizationId = org.id;
        }
        if (!organizationId && instanceIp) {
          const org = await prisma.organization.findFirst({ where: { serverIp: instanceIp } });
          if (org) organizationId = org.id;
        }
        if (!organizationId && sourceIp) {
          const org = await prisma.organization.findFirst({ where: { serverIp: sourceIp } });
          if (org) organizationId = org.id;
        }
      }
      if (!organizationId) {
        results.push({ alertId, action: 'skipped-no-org' });
        continue;
      }

      const existing = await prisma.alert.findFirst({
        where: { alertId, organizationId },
      });

      if (a.status === 'resolved' && existing) {
        await prisma.alert.update({ where: { id: existing.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
        emitToAll('alert:resolved', { id: existing.id, name: existing.name });
        results.push({ alertId, action: 'resolved' });
      } else if (!existing) {
        const severity = (a.labels?.severity || 'warning').toUpperCase();
        const configItemId = await resolveInstanceToConfigItem(a.labels?.instance);

        // ── "Ok" / recovery alert detection ──────────────────
        // Alert names like CPUOk, LoadOk, diskOk, LoginOk are recovery notifications
        // They mean the problem is resolved — store as RESOLVED and auto-resolve matching warning
        const alertName = a.labels?.alertname || 'Unknown';
        const isRecoveryAlert = /Ok[-.]|ok[-.]|normal.state|able.to.access/i.test(alertName);

        // Auto-resolve the corresponding warning alert for this instance
        if (isRecoveryAlert && instanceIp) {
          const basePattern = alertName.replace(/Ok[-.]?.*/, '').replace(/ok[-.]?.*/, '');
          if (basePattern.length > 2) {
            const staleWarnings = await prisma.alert.updateMany({
              where: {
                status: 'FIRING',
                organizationId,
                AND: [
                  { name: { contains: basePattern, mode: 'insensitive' } },
                  { name: { contains: instanceIp } },
                ],
              },
              data: { status: 'RESOLVED', resolvedAt: new Date() },
            });
            if (staleWarnings.count > 0) {
              logger.info(`[Webhook] Auto-resolved ${staleWarnings.count} warning(s) matching ${basePattern}*${instanceIp}`);
            }
          }
        }

        const alert = await prisma.alert.create({
          data: {
            alertId,
            name: alertName,
            severity: severity === 'CRITICAL' ? 'CRITICAL' : severity === 'WARNING' ? 'WARNING' : 'INFO',
            status: isRecoveryAlert ? 'RESOLVED' : 'FIRING',
            source: 'PROMETHEUS',
            description: a.annotations?.description || a.annotations?.summary || '',
            metric: a.labels?.alertname,
            currentValue: a.annotations?.value || a.labels?.value,
            threshold: a.annotations?.threshold,
            labels: JSON.stringify(a.labels),
            annotations: JSON.stringify(a.annotations),
            firedAt: a.startsAt ? new Date(a.startsAt) : new Date(),
            organizationId,
            ...(isRecoveryAlert && { resolvedAt: new Date() }),
            ...(configItemId && { configItemId }),
          },
        });

        if (isRecoveryAlert) {
          emitToAll('alert:resolved', { id: alert.id, name: alert.name });
          results.push({ alertId, action: 'recovery-resolved' });
          continue; // Skip incident creation for recovery alerts
        }

        emitToAll('alert:fired', { id: alert.id, name: alert.name, severity: alert.severity });

        // Auto-create incident ONLY for CRITICAL and WARNING alerts
        if (alert.severity === 'CRITICAL' || alert.severity === 'WARNING') {
          try {
            const incData = await buildIncidentFromAlert(alert);
            const incNumber = await generateIncidentNumber();
            const createdById = await getSystemUserId();
            const priority = incData.urgency === 'CRITICAL' ? 'P1' : incData.urgency === 'HIGH' ? 'P2' : 'P3';
            const slaTargets = calculateSLATargetTimes(priority, new Date());
            const { assignmentGroupId, assignedToId } = await resolveTeamAndAssignee(
              incData.configItemId, incData.category, incData.organizationId
            );

            const incident = await prisma.incident.create({
              data: {
                number: incNumber,
                shortDescription: incData.shortDescription,
                description: incData.description,
                state: 'NEW',
                impact: incData.impact,
                urgency: incData.urgency,
                priority,
                source: incData.source,
                sourceAlertId: alert.alertId,
                sourceAlertName: alert.name,
                category: incData.category || null,
                subcategory: incData.subcategory || null,
                ...slaTargets,
                ...(createdById && { createdById }),
                ...(assignmentGroupId && { assignmentGroupId }),
                ...(assignedToId && { assignedToId }),
                ...(incData.configItemId && { configItemId: incData.configItemId }),
                ...(incData.organizationId && { organizationId: incData.organizationId }),
              },
            });
            emitToAll('incident:created', { id: incident.id, number: incident.number, priority: incident.priority });
            if (assignmentGroupId) emitToTeam(assignmentGroupId, 'incident:assigned', { id: incident.id, number: incident.number, priority });
            if (assignedToId) emitToUser(assignedToId, 'incident:assigned-to-you', { id: incident.id, number: incident.number, priority });
            logger.info(`Auto-created incident ${incident.number} (${priority}, cat=${incData.category}, team=${assignmentGroupId || 'none'}) from ${alert.severity} alert ${alert.name}`);
          } catch (incErr) {
            logger.error(`Auto-incident creation failed for alert ${alert.name}: ${incErr.message}`);
          }
        } else {
          logger.info(`Skipping auto-incident for INFO alert ${alert.name} — only CRITICAL/WARNING create incidents`);
        }

        // ── AI Agent Pipeline: async triage → remediate → notify → verify ──
        agentPipeline.processAlert(alert, a.labels).catch(pipeErr => {
          logger.error('[AgentPipeline] Async processing failed for %s: %s', alert.name, pipeErr.message);
        });

        results.push({ alertId, action: 'created', severity: alert.severity });
      }
    }

    logger.info(`Alertmanager webhook: ${results.length} alerts processed (group: ${JSON.stringify(groupLabels)})`);
    return success(res, { processed: results.length, results });
  } catch (err) { next(err); }
}

// POST /api/v1/webhooks/grafana?orgId=<uuid>
async function grafanaWebhook(req, res, next) {
  try {
    const sourceIp = getSourceIp(req);
    if (BLOCKED_SOURCE_IPS.has(sourceIp)) {
      logger.info('[Webhook] Blocked grafana webhook from offboarded IP: %s', sourceIp);
      return res.status(200).json({ success: true, message: 'received' });
    }

    const auth = await authenticateAlertWebhook(req);
    if (auth.error) return error(res, auth.error, 401);

    const { title, state, message, ruleName, ruleUrl, evalMatches } = req.body;

    // Resolve org: token first; legacy may use ?orgId= / ?orgSlug= / source IP.
    // Never look up or write alerts without a resolved organizationId.
    let organizationId = auth.orgId;
    const qOrgId = req.query.orgId || req.query.org_id;
    const qOrgSlug = req.query.orgSlug || req.query.org_slug;
    if (!auth.legacy) {
      // token decided the org
    } else if (qOrgId) {
      const org = await prisma.organization.findUnique({ where: { id: qOrgId } });
      if (org) organizationId = org.id;
    } else if (qOrgSlug) {
      const org = await prisma.organization.findUnique({ where: { slug: qOrgSlug } });
      if (org) organizationId = org.id;
    } else if (sourceIp) {
      const org = await prisma.organization.findFirst({ where: { serverIp: sourceIp } });
      if (org) organizationId = org.id;
    }

    if (!organizationId) return error(res, 'Could not resolve organization for webhook', 400);

    if (state === 'alerting') {
      const alertId = `grafana:${ruleName || title}`;
      const existing = await prisma.alert.findFirst({ where: { alertId, organizationId } });

      if (!existing) {
        const alert = await prisma.alert.create({
          data: {
            alertId,
            name: ruleName || title || 'Grafana Alert',
            severity: 'WARNING',
            status: 'FIRING',
            source: 'GRAFANA',
            description: message || '',
            labels: JSON.stringify({ ruleUrl }),
            annotations: JSON.stringify(evalMatches || []),
            firedAt: new Date(),
            ...(organizationId && { organizationId }),
          },
        });
        emitToAll('alert:fired', { id: alert.id, name: alert.name, severity: alert.severity, source: 'GRAFANA' });
        logger.info(`Grafana alert created: ${alert.name} (org: ${organizationId || 'global'})`);

        // Auto-create incident from Grafana alert (WARNING → P3)
        try {
          const incData = await buildIncidentFromAlert(alert);
          const incNumber = await generateIncidentNumber();
          const createdById = await getSystemUserId();
          const priority = incData.urgency === 'CRITICAL' ? 'P1' : incData.urgency === 'HIGH' ? 'P2' : 'P3';
          const slaTargets = calculateSLATargetTimes(priority, new Date());
          const { assignmentGroupId, assignedToId } = await resolveTeamAndAssignee(
            incData.configItemId, incData.category, incData.organizationId
          );

          const incident = await prisma.incident.create({
            data: {
              number: incNumber,
              shortDescription: incData.shortDescription,
              description: incData.description,
              state: 'NEW',
              impact: incData.impact,
              urgency: incData.urgency,
              priority,
              source: 'GRAFANA',
              sourceAlertId: alert.alertId,
              sourceAlertName: alert.name,
              category: incData.category || null,
              subcategory: incData.subcategory || null,
              ...slaTargets,
              ...(createdById && { createdById }),
              ...(assignmentGroupId && { assignmentGroupId }),
              ...(assignedToId && { assignedToId }),
              ...(organizationId && { organizationId }),
            },
          });
          emitToAll('incident:created', { id: incident.id, number: incident.number, priority: incident.priority });
          if (assignmentGroupId) emitToTeam(assignmentGroupId, 'incident:assigned', { id: incident.id, number: incident.number, priority });
          if (assignedToId) emitToUser(assignedToId, 'incident:assigned-to-you', { id: incident.id, number: incident.number, priority });
          logger.info(`Auto-created incident ${incident.number} (${priority}) from Grafana alert ${alert.name}`);
        } catch (incErr) {
          logger.error(`Grafana auto-incident creation failed for ${alert.name}: ${incErr.message}`);
        }
      }
    } else if (state === 'ok') {
      const alertId = `grafana:${ruleName || title}`;
      const existing = await prisma.alert.findFirst({ where: { alertId, status: 'FIRING', organizationId } });
      if (existing) {
        await prisma.alert.update({ where: { id: existing.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
        emitToAll('alert:resolved', { id: existing.id, name: existing.name });
      }
    }

    return success(res, { received: true });
  } catch (err) { next(err); }
}

// POST /api/v1/webhooks/slack/commands
async function slackSlashCommand(req, res, next) {
  try {
    const bad = verifySlackRequest(req);
    if (bad) return res.status(bad.status).json({ error: bad.error });

    const { command, text, response_url, user_name, channel_name } = req.body;
    logger.info(`Slack command: ${command} "${text}" from @${user_name} in #${channel_name}`);

    const response = await slackService.handleSlashCommand(command, text, response_url);
    return res.json(response);
  } catch (err) { next(err); }
}

// POST /api/v1/webhooks/slack/interactive
async function slackInteractive(req, res, next) {
  try {
    const bad = verifySlackRequest(req);
    if (bad) return res.status(bad.status).json({ error: bad.error });

    let payload;
    try { payload = JSON.parse(req.body.payload || '{}'); } catch { return res.status(400).json({ error: 'Malformed payload' }); }
    const { type, actions, user } = payload;

    // A button click may only act on the org linked to the clicking workspace.
    const link = payload.team?.id
      ? await prisma.slackIntegration.findFirst({
        where: { workspaceId: payload.team.id, isActive: true, organizationId: { not: null } },
        select: { organizationId: true },
      })
      : null;
    if (!link) return res.json({ text: 'This Slack workspace is not linked to a WeCrew ITSM organization.' });
    const orgId = link.organizationId;

    if (type === 'block_actions' && actions?.length > 0) {
      const action = actions[0];
      logger.info(`Slack interactive: ${action.action_id} by ${user?.username}`);

      if (action.action_id.startsWith('ack_incident_')) {
        const incidentId = action.action_id.replace('ack_incident_', '');
        // Acknowledge incident — only inside the linked org
        const { count } = await prisma.incident.updateMany({
          where: { id: incidentId, organizationId: orgId },
          data: { state: 'IN_PROGRESS' },
        });
        if (!count) return res.json({ text: 'Incident not found.' });
        return res.json({ text: `Incident acknowledged by ${user?.username}` });
      }

      if (action.action_id.startsWith('ack_alert_')) {
        const alertId = action.action_id.replace('ack_alert_', '');
        const { count } = await prisma.alert.updateMany({
          where: { id: alertId, organizationId: orgId },
          data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
        });
        if (!count) return res.json({ text: 'Alert not found.' });
        return res.json({ text: `Alert acknowledged by ${user?.username}` });
      }
    }

    return res.json({ ok: true });
  } catch (err) { next(err); }
}

// POST /api/v1/webhooks/servicenow
async function serviceNowWebhook(req, res, next) {
  try {
    const { sys_id, number, state, short_description, priority } = req.body;
    logger.info(`ServiceNow webhook: ${number} (${state})`);

    // Log webhook receipt
    await prisma.auditLog.create({
      data: {
        action: 'WEBHOOK_RECEIVED',
        entityType: 'INTEGRATION',
        entityId: sys_id || 'unknown',
        newData: { source: 'ServiceNow', number, state },
      },
    });

    return success(res, { received: true, number });
  } catch (err) { next(err); }
}

// POST /api/v1/webhooks/generic
async function genericWebhook(req, res, next) {
  try {
    const { source, event_type, payload: eventPayload } = req.body;
    logger.info(`Generic webhook: ${source} — ${event_type}`);

    await prisma.auditLog.create({
      data: {
        action: 'WEBHOOK_RECEIVED',
        entityType: 'INTEGRATION',
        entityId: source || 'unknown',
        newData: { source, event_type, payload: eventPayload },
      },
    });

    return success(res, { received: true });
  } catch (err) { next(err); }
}

module.exports = {
  alertmanagerWebhook, grafanaWebhook,
  slackSlashCommand, slackInteractive,
  serviceNowWebhook, genericWebhook,
};
