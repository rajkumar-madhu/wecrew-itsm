// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — AI Agent Pipeline (StackStorm Replacement)
// Event-Driven Automation: Detect → Triage → Act → Notify → Verify
// Zero extra pods — runs inside LinkedEye API process
// Multi-Tenant: per-org pipeline state, actions, notifications
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { emitToAll } = require('../config/socket');
const logger = require('../utils/logger');
const slackService = require('./slackService');
const { config } = require('../config/env');

// ── Multi-Tenant Pipeline State ──────────────────────────
const GLOBAL_KEY = '__global__';
const orgPipelineStates = new Map();   // Map<orgId|'__global__', state>
const orgActionOverrides = new Map();  // Map<orgId, Map<actionId, boolean>>
const orgNotifOverrides = new Map();   // Map<orgId, Map<ruleId, boolean>>

function DEFAULT_ORG_STATE() {
  return {
    enabled: true,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    lastExecutionAt: null,
    startedAt: new Date().toISOString(),
    executionLog: [],  // Ring buffer (last 100)
  };
}

// Initialize global state
orgPipelineStates.set(GLOBAL_KEY, DEFAULT_ORG_STATE());

/** Lazy-init per-org state — new orgs auto-inherit enabled: true */
function getOrgState(orgId) {
  const key = orgId || GLOBAL_KEY;
  if (!orgPipelineStates.has(key)) {
    orgPipelineStates.set(key, DEFAULT_ORG_STATE());
  }
  return orgPipelineStates.get(key);
}

/** Check if a remediation action is enabled for an org (override → global default) */
function isActionEnabled(orgId, actionId) {
  const key = orgId || GLOBAL_KEY;
  const overrides = orgActionOverrides.get(key);
  if (overrides && overrides.has(actionId)) return overrides.get(actionId);
  // Fall back to global default from REMEDIATION_ACTIONS array
  const action = REMEDIATION_ACTIONS.find(a => a.id === actionId);
  return action ? action.enabled : false;
}

/** Check if a notification rule is enabled for an org (override → global default) */
function isNotifEnabled(orgId, ruleId) {
  const key = orgId || GLOBAL_KEY;
  const overrides = orgNotifOverrides.get(key);
  if (overrides && overrides.has(ruleId)) return overrides.get(ruleId);
  // Fall back to global default from NOTIFICATION_RULES array
  const rule = NOTIFICATION_RULES.find(r => r.id === ruleId);
  return rule ? rule.enabled : false;
}

// ── Remediation Actions Registry ───────────────────────────
// Each action: { id, name, description, category, severity, condition, action, enabled }
const REMEDIATION_ACTIONS = [
  {
    id: 'disk-cleanup',
    name: 'Disk Space Cleanup',
    description: 'Clear log files, package cache, and container images when disk > 85%',
    category: 'Storage',
    targetSeverity: ['CRITICAL', 'WARNING'],
    matchAlerts: ['NodeDiskRunningFull', 'HostDiskAlmostFull', 'NodeFilesystemAlmostOutOfSpace', 'NodeFilesystemSpaceFillingUp'],
    enabled: true,
    commands: [
      'sudo journalctl --vacuum-time=3d',
      'sudo apt-get clean 2>/dev/null || sudo yum clean all 2>/dev/null',
      'sudo find /var/log -name "*.gz" -mtime +7 -delete',
      'sudo find /tmp -mtime +7 -delete',
    ],
    verifyQuery: 'node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|devtmpfs|overlay"}',
    verifyThreshold: 0.15, // Expect 15%+ free after cleanup
  },
  {
    id: 'pod-restart',
    name: 'Restart CrashLooping Pod',
    description: 'Delete and let K8s reschedule pods stuck in CrashLoopBackOff',
    category: 'Kubernetes',
    targetSeverity: ['CRITICAL', 'WARNING'],
    matchAlerts: ['KubePodCrashLooping', 'KubePodNotReady'],
    enabled: true,
    commands: [], // Dynamic — built from alert labels (namespace, pod)
    verifyQuery: 'kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}',
    verifyThreshold: 0,
  },
  {
    id: 'service-restart',
    name: 'Restart System Service',
    description: 'Restart kubelet or containerd when node health degrades',
    category: 'Infrastructure',
    targetSeverity: ['CRITICAL'],
    matchAlerts: ['KubeNodeNotReady'],
    enabled: true,
    commands: [
      'sudo systemctl restart kubelet',
    ],
    verifyQuery: 'kube_node_status_condition{condition="Ready",status="true"}',
    verifyThreshold: 1,
  },
  {
    id: 'memory-release',
    name: 'Release Memory Cache',
    description: 'Drop filesystem caches when memory utilization > 90%',
    category: 'Compute',
    targetSeverity: ['CRITICAL', 'WARNING'],
    matchAlerts: ['HostHighMemoryUsage', 'NodeMemoryHighUtilization', 'HostMemoryUnderMemoryPressure'],
    enabled: true,
    commands: [
      'sudo sync && sudo sh -c "echo 3 > /proc/sys/vm/drop_caches"',
    ],
    verifyQuery: 'node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes',
    verifyThreshold: 0.1,
  },
  {
    id: 'log-rotate',
    name: 'Force Log Rotation',
    description: 'Force rotate all logs when disk pressure from log accumulation',
    category: 'Storage',
    targetSeverity: ['CRITICAL', 'WARNING'],
    matchAlerts: ['NodeDiskRunningFull', 'HostDiskAlmostFull'],
    enabled: true,
    commands: [
      'sudo logrotate -f /etc/logrotate.conf',
    ],
    verifyQuery: 'node_filesystem_avail_bytes{mountpoint="/var/log",fstype!~"tmpfs|devtmpfs"}',
    verifyThreshold: 0.10,
  },
  {
    id: 'container-prune',
    name: 'Prune Container Images',
    description: 'Remove unused container images and build cache',
    category: 'Kubernetes',
    targetSeverity: ['WARNING'],
    matchAlerts: ['NodeDiskRunningFull', 'KubeNodeDiskPressure'],
    enabled: true,
    commands: [
      'sudo crictl rmi --prune 2>/dev/null || sudo docker image prune -af 2>/dev/null',
    ],
    verifyQuery: 'node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|devtmpfs|overlay"}',
    verifyThreshold: 0.15,
  },
  {
    id: 'deployment-scale',
    name: 'Scale Deployment Replicas',
    description: 'Scale up deployment when replicas mismatch detected',
    category: 'Kubernetes',
    targetSeverity: ['WARNING'],
    matchAlerts: ['KubeDeploymentReplicasMismatch'],
    enabled: true,
    commands: [], // Dynamic — built from alert labels
    verifyQuery: 'kube_deployment_status_replicas_available',
    verifyThreshold: 1,
  },
  {
    id: 'ssl-check',
    name: 'Certificate Expiry Check',
    description: 'Check and report certificate expiry status',
    category: 'Security',
    targetSeverity: ['WARNING', 'CRITICAL'],
    matchAlerts: ['CertificateExpiringSoon', 'SSLCertificateExpiry'],
    enabled: true,
    commands: [], // Diagnostic only — no auto-action
    verifyQuery: null,
    verifyThreshold: null,
  },
];

// ── Notification Rules ─────────────────────────────────────
const NOTIFICATION_RULES = [
  {
    id: 'critical-slack',
    name: 'Critical Alert → Slack',
    severity: ['CRITICAL'],
    channel: 'slack',
    enabled: true,
  },
  {
    id: 'critical-pagerduty',
    name: 'Critical Alert → PagerDuty',
    severity: ['CRITICAL'],
    channel: 'pagerduty',
    enabled: true,
  },
  {
    id: 'warning-slack',
    name: 'Warning Alert → Slack',
    severity: ['WARNING'],
    channel: 'slack',
    enabled: true,
  },
  {
    id: 'incident-created-slack',
    name: 'New Incident → Slack',
    event: 'incident:created',
    channel: 'slack',
    enabled: true,
  },
];

// ═══════════════════════════════════════════════════════════
// CORE PIPELINE: processAlert() — called from webhook controller
// ═══════════════════════════════════════════════════════════

async function processAlert(alert, rawLabels = {}) {
  const orgId = alert.organizationId || null;
  const orgState = getOrgState(orgId);
  const globalState = getOrgState(null); // always '__global__'

  if (!orgState.enabled) {
    logger.info('[AgentPipeline] Pipeline disabled for org %s — skipping alert %s', orgId || 'global', alert.name);
    return { action: 'skipped', reason: 'pipeline_disabled' };
  }

  const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();
  const steps = [];

  try {
    orgState.totalExecutions++;
    orgState.lastExecutionAt = new Date().toISOString();
    // Also count in global aggregate
    if (orgId) {
      globalState.totalExecutions++;
      globalState.lastExecutionAt = orgState.lastExecutionAt;
    }

    // ── Stage 1: DETECT — Classify alert ──
    steps.push({ stage: 'detect', status: 'complete', detail: `Alert ${alert.name} [${alert.severity}] received`, ts: Date.now() });

    // ── Stage 2: TRIAGE — Match remediation action ──
    const matchedAction = findRemediationAction(alert, orgId);
    if (matchedAction) {
      steps.push({ stage: 'triage', status: 'complete', detail: `Matched action: ${matchedAction.name}`, ts: Date.now() });
    } else {
      steps.push({ stage: 'triage', status: 'complete', detail: 'No remediation action matched — notification only', ts: Date.now() });
    }

    // ── Stage 3: ENRICH — Gather context from Prometheus + CMDB ──
    let enrichment = null;
    try {
      enrichment = await enrichAlertContext(alert, rawLabels);
      steps.push({ stage: 'enrich', status: 'complete', detail: `Context: ${enrichment.hostname || 'unknown'} (${enrichment.orgName || 'global'})`, ts: Date.now() });
    } catch (enrichErr) {
      steps.push({ stage: 'enrich', status: 'warning', detail: `Enrichment partial: ${enrichErr.message}`, ts: Date.now() });
    }

    // ── Stage 4: ACT — Execute remediation (if matched + enabled + approved) ──
    let actionResult = null;
    if (matchedAction && isActionEnabled(orgId, matchedAction.id)) {
      // Auto-remediation requires: severity is CRITICAL, and action has commands
      const canAutoRemediate = alert.severity === 'CRITICAL' && matchedAction.commands.length > 0;
      if (canAutoRemediate && enrichment?.access?.method === 'ssh') {
        try {
          actionResult = await executeRemediation(matchedAction, alert, enrichment);
          steps.push({ stage: 'action', status: actionResult.success ? 'complete' : 'failed', detail: actionResult.message, ts: Date.now() });
        } catch (actErr) {
          actionResult = { success: false, message: actErr.message };
          steps.push({ stage: 'action', status: 'failed', detail: actErr.message, ts: Date.now() });
        }
      } else {
        steps.push({ stage: 'action', status: 'skipped', detail: canAutoRemediate ? 'No SSH access' : 'Auto-remediation only for CRITICAL', ts: Date.now() });
      }
    }

    // ── Stage 5: NOTIFY — Route notifications by rules ──
    const notifyResults = await routeNotifications(alert, enrichment, orgId);
    steps.push({ stage: 'notify', status: 'complete', detail: `${notifyResults.length} notification(s) sent`, ts: Date.now() });

    // ── Stage 6: VERIFY — Post-action verification ──
    if (actionResult?.success && matchedAction?.verifyQuery && enrichment?.access) {
      try {
        const verified = await verifyRemediation(matchedAction, enrichment);
        steps.push({ stage: 'verify', status: verified ? 'complete' : 'warning', detail: verified ? 'Remediation verified' : 'Verification pending', ts: Date.now() });
      } catch (verifyErr) {
        steps.push({ stage: 'verify', status: 'warning', detail: `Verify failed: ${verifyErr.message}`, ts: Date.now() });
      }
    }

    // ── Record execution ──
    const duration = Date.now() - startTime;
    const execution = {
      id: executionId,
      alertId: alert.alertId,
      alertName: alert.name,
      severity: alert.severity,
      organizationId: orgId,
      orgName: enrichment?.orgName || null,
      orgEnvironment: enrichment?.orgEnv || null,
      matchedAction: matchedAction?.id || null,
      actionResult: actionResult?.success || null,
      steps,
      duration,
      timestamp: new Date().toISOString(),
    };

    orgState.successfulExecutions++;
    addToLog(orgState, execution);
    // Also record in global log so super-admin sees all
    if (orgId) {
      globalState.successfulExecutions++;
      addToLog(globalState, execution);
    }
    emitToAll('pipeline:execution', execution);

    logger.info('[AgentPipeline] Execution %s completed in %dms: %s → %s (org: %s)',
      executionId, duration, alert.name, matchedAction?.name || 'notify-only', orgId || 'global');

    return execution;
  } catch (err) {
    orgState.failedExecutions++;
    if (orgId) globalState.failedExecutions++;

    const execution = {
      id: executionId,
      alertId: alert.alertId,
      alertName: alert.name,
      severity: alert.severity,
      organizationId: orgId,
      error: err.message,
      steps,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
    addToLog(orgState, execution);
    if (orgId) addToLog(globalState, execution);
    logger.error('[AgentPipeline] Execution %s failed: %s', executionId, err.message);
    return execution;
  }
}

// ═══════════════════════════════════════════════════════════
// Stage 2: TRIAGE — Find matching remediation action
// ═══════════════════════════════════════════════════════════

function findRemediationAction(alert, orgId) {
  const alertName = (alert.name || '').toLowerCase();

  for (const action of REMEDIATION_ACTIONS) {
    if (!isActionEnabled(orgId, action.id)) continue;
    if (!action.targetSeverity.includes(alert.severity)) continue;

    // Check if alert name matches any of the action's patterns
    const matched = action.matchAlerts.some(pattern => {
      const p = pattern.toLowerCase();
      return alertName.includes(p) || p.includes(alertName);
    });

    if (matched) return action;
  }

  // Fuzzy match by category keywords
  if (alertName.includes('disk') || alertName.includes('filesystem')) {
    return REMEDIATION_ACTIONS.find(a => a.id === 'disk-cleanup' && isActionEnabled(orgId, a.id));
  }
  if (alertName.includes('mem') || alertName.includes('oom')) {
    return REMEDIATION_ACTIONS.find(a => a.id === 'memory-release' && isActionEnabled(orgId, a.id));
  }
  if (alertName.includes('crash') || alertName.includes('pod')) {
    return REMEDIATION_ACTIONS.find(a => a.id === 'pod-restart' && isActionEnabled(orgId, a.id));
  }
  if (alertName.includes('node') && alertName.includes('ready')) {
    return REMEDIATION_ACTIONS.find(a => a.id === 'service-restart' && isActionEnabled(orgId, a.id));
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
// Stage 3: ENRICH — Gather context from Prometheus + CMDB
// ═══════════════════════════════════════════════════════════

async function enrichAlertContext(alert, rawLabels = {}) {
  const labels = rawLabels || {};
  try { Object.assign(labels, JSON.parse(alert.labels || '{}')); } catch (e) { logger.warn('[agentPipeline] Failed to parse alert labels: %s', e.message); }

  const instance = labels.instance || labels.target || '';
  const ip = instance.split(':')[0] || labels.ip || '';
  const hostname = labels.hostname || labels.nodename || labels.node || labels.host || '';
  const namespace = labels.namespace || '';
  const pod = labels.pod || labels.pod_name || '';

  // Resolve org + Prometheus access
  let org = null;
  let access = { method: 'local' };
  if (alert.organizationId) {
    const aiController = require('../controllers/aiAgent.controller');
    [org, access] = await Promise.all([
      prisma.organization.findUnique({ where: { id: alert.organizationId }, select: { name: true, environment: true, serverIp: true } }),
      aiController.resolvePrometheusAccess(alert.organizationId),
    ]);
  }

  // Resolve CMDB asset
  let asset = null;
  if (ip && alert.organizationId) {
    asset = await prisma.configurationItem.findFirst({
      where: { organizationId: alert.organizationId, ipAddress: { contains: ip } },
      select: { id: true, name: true, hostname: true, type: true, os: true },
    });
  }

  return {
    ip,
    hostname: asset?.hostname || asset?.name || hostname,
    instance,
    namespace,
    pod,
    orgName: org?.name || null,
    orgEnv: org?.environment || null,
    orgIp: org?.serverIp || null,
    access,
    asset,
  };
}

// ═══════════════════════════════════════════════════════════
// Stage 4: ACT — Execute remediation via SSH
// ═══════════════════════════════════════════════════════════

async function executeRemediation(action, alert, enrichment) {
  const { access } = enrichment;
  if (access.method !== 'ssh' || !access.serverIp) {
    return { success: false, message: 'SSH access not available for this org' };
  }

  // Build dynamic commands for K8s actions
  let commands = [...action.commands];
  if (action.id === 'pod-restart' && enrichment.pod && enrichment.namespace) {
    commands = [`sudo kubectl delete pod ${enrichment.pod} -n ${enrichment.namespace} --grace-period=30`];
  }
  if (action.id === 'deployment-scale' && enrichment.namespace) {
    // Extract deployment name from alert labels
    let labels = {};
    try { labels = JSON.parse(alert.labels || '{}'); } catch (e) { logger.warn('[agentPipeline] Failed to parse alert labels: %s', e.message); }
    const deployment = labels.deployment || labels.deployment_name || '';
    if (deployment) {
      commands = [`sudo kubectl scale deployment/${deployment} -n ${enrichment.namespace} --replicas=$(sudo kubectl get deployment ${deployment} -n ${enrichment.namespace} -o jsonpath='{.spec.replicas}')`];
    }
  }

  if (commands.length === 0) {
    return { success: false, message: 'No executable commands for this action' };
  }

  // Execute via SSH
  const k8sService = require('./k8sService');
  const outputs = [];
  for (const cmd of commands) {
    try {
      const result = await k8sService.sshCmd(
        access.serverIp,
        cmd,
        access.sshPort || 4422,
        access.sshUser || 'finadmin'
      );
      outputs.push({ cmd, output: (result || '').substring(0, 500), success: true });
    } catch (cmdErr) {
      outputs.push({ cmd, output: cmdErr.message, success: false });
    }
  }

  const allSuccess = outputs.every(o => o.success);

  // Log as work note on the incident if one exists
  try {
    const incident = await prisma.incident.findFirst({
      where: { sourceAlertId: alert.alertId, state: { in: ['NEW', 'IN_PROGRESS'] } },
      select: { id: true, number: true },
    });
    if (incident) {
      // Find system user for work notes
      const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
      if (systemUser) {
        await prisma.workNote.create({
          data: {
            incidentId: incident.id,
            authorId: systemUser.id,
            source: 'AI',
            isInternal: true,
            content: `[AI Agent Pipeline] Auto-remediation: ${action.name}\n\n` +
              outputs.map(o => `$ ${o.cmd}\n→ ${o.success ? 'OK' : 'FAILED'}: ${o.output}`).join('\n\n') +
              `\n\nResult: ${allSuccess ? 'SUCCESS' : 'PARTIAL FAILURE'}`,
          },
        });
      }
    }
  } catch (noteErr) {
    logger.warn('[AgentPipeline] Work note creation failed: %s', noteErr.message);
  }

  return {
    success: allSuccess,
    message: allSuccess
      ? `${action.name} executed successfully (${outputs.length} commands)`
      : `${action.name} partial failure (${outputs.filter(o => o.success).length}/${outputs.length} succeeded)`,
    outputs,
  };
}

// ═══════════════════════════════════════════════════════════
// Stage 5: NOTIFY — Route by notification rules (org-scoped)
// ═══════════════════════════════════════════════════════════

async function routeNotifications(alert, enrichment, orgId) {
  const results = [];

  for (const rule of NOTIFICATION_RULES) {
    if (!isNotifEnabled(orgId, rule.id)) continue;

    // Match by severity
    if (rule.severity && !rule.severity.includes(alert.severity)) continue;

    try {
      if (rule.channel === 'slack') {
        await slackService.notifyAlert({
          ...alert,
          _enrichment: enrichment,
        }).catch(() => {});
        results.push({ rule: rule.id, channel: 'slack', status: 'sent' });
      }

      if (rule.channel === 'pagerduty') {
        // PagerDuty Events API v2
        const pdResult = await sendPagerDutyEvent(alert, enrichment);
        results.push({ rule: rule.id, channel: 'pagerduty', status: pdResult ? 'sent' : 'skipped' });
      }
    } catch (notifyErr) {
      results.push({ rule: rule.id, channel: rule.channel, status: 'failed', error: notifyErr.message });
    }
  }

  return results;
}

// ── PagerDuty Events API v2 integration ──
async function sendPagerDutyEvent(alert, enrichment) {
  // Check if org has PagerDuty integration
  if (!alert.organizationId) return null;

  const pdIntegration = await prisma.integration.findFirst({
    where: { organizationId: alert.organizationId, type: 'PAGERDUTY', status: 'ACTIVE' },
    select: { config: true },
  });

  if (!pdIntegration?.config) return null;

  let pdConfig;
  try { pdConfig = JSON.parse(pdIntegration.config); } catch { return null; }

  const routingKey = pdConfig.routingKey || pdConfig.integrationKey;
  if (!routingKey) return null;

  try {
    const axios = require('axios');
    await axios.post('https://events.pagerduty.com/v2/enqueue', {
      routing_key: routingKey,
      event_action: 'trigger',
      dedup_key: alert.alertId,
      payload: {
        summary: `[${alert.severity}] ${alert.name} on ${enrichment?.hostname || enrichment?.ip || 'unknown'}`,
        severity: alert.severity === 'CRITICAL' ? 'critical' : alert.severity === 'WARNING' ? 'warning' : 'info',
        source: enrichment?.hostname || enrichment?.ip || 'LinkedEye',
        component: enrichment?.pod || enrichment?.namespace || alert.name,
        group: enrichment?.orgName || 'LinkedEye',
        class: alert.source || 'PROMETHEUS',
        custom_details: {
          alert_id: alert.alertId,
          organization: enrichment?.orgName,
          environment: enrichment?.orgEnv,
          instance: enrichment?.instance,
          fired_at: alert.firedAt?.toISOString?.() || new Date().toISOString(),
        },
      },
      links: [{
        href: `https://fs-le-dev-inc.finspot.in/alerts`,
        text: 'View in LinkedEye',
      }],
    }, { timeout: 10000 });

    logger.info('[AgentPipeline] PagerDuty event sent for %s', alert.name);
    return true;
  } catch (pdErr) {
    logger.warn('[AgentPipeline] PagerDuty send failed: %s', pdErr.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// Stage 6: VERIFY — Post-action verification
// ═══════════════════════════════════════════════════════════

async function verifyRemediation(action, enrichment) {
  if (!action.verifyQuery || !enrichment.access || enrichment.access.method === 'local') {
    return null;
  }

  // Wait a brief period for metrics to reflect changes
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    const aiController = require('../controllers/aiAgent.controller');
    const result = await aiController.executePromQueries(enrichment.access, {
      verify: action.verifyQuery,
    });

    const value = parseFloat(result?.verify?.result?.[0]?.value?.[1] || '0');
    return value >= action.verifyThreshold;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// PIPELINE STATUS & MANAGEMENT API (org-scoped)
// ═══════════════════════════════════════════════════════════

function getStatus(orgId) {
  const state = getOrgState(orgId);
  return {
    enabled: state.enabled,
    totalExecutions: state.totalExecutions,
    successfulExecutions: state.successfulExecutions,
    failedExecutions: state.failedExecutions,
    successRate: state.totalExecutions > 0
      ? ((state.successfulExecutions / state.totalExecutions) * 100).toFixed(1)
      : '0',
    lastExecutionAt: state.lastExecutionAt,
    startedAt: state.startedAt,
    uptime: Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000),
    remediationActions: REMEDIATION_ACTIONS.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      category: a.category,
      targetSeverity: a.targetSeverity,
      matchAlerts: a.matchAlerts,
      enabled: isActionEnabled(orgId, a.id),
    })),
    notificationRules: NOTIFICATION_RULES.map(r => ({
      id: r.id,
      name: r.name,
      severity: r.severity,
      channel: r.channel,
      enabled: isNotifEnabled(orgId, r.id),
    })),
    recentExecutions: state.executionLog.slice(-20),
  };
}

function setEnabled(orgId, enabled) {
  const state = getOrgState(orgId);
  state.enabled = !!enabled;
  const key = orgId || 'global';
  logger.info('[AgentPipeline] Pipeline %s for org %s', enabled ? 'ENABLED' : 'DISABLED', key);
  return state.enabled;
}

function toggleAction(orgId, actionId, enabled) {
  const action = REMEDIATION_ACTIONS.find(a => a.id === actionId);
  if (!action) return null;

  const key = orgId || GLOBAL_KEY;
  if (!orgActionOverrides.has(key)) orgActionOverrides.set(key, new Map());
  orgActionOverrides.get(key).set(actionId, !!enabled);

  logger.info('[AgentPipeline] Action %s %s for org %s', actionId, enabled ? 'enabled' : 'disabled', key);
  return { ...action, enabled: !!enabled };
}

function toggleNotificationRule(orgId, ruleId, enabled) {
  const rule = NOTIFICATION_RULES.find(r => r.id === ruleId);
  if (!rule) return null;

  const key = orgId || GLOBAL_KEY;
  if (!orgNotifOverrides.has(key)) orgNotifOverrides.set(key, new Map());
  orgNotifOverrides.get(key).set(ruleId, !!enabled);

  logger.info('[AgentPipeline] Notification rule %s %s for org %s', ruleId, enabled ? 'enabled' : 'disabled', key);
  return { ...rule, enabled: !!enabled };
}

function getExecutionLog(orgId, limit = 50, offset = 0) {
  const state = getOrgState(orgId);
  const log = [...state.executionLog].reverse();
  return {
    total: log.length,
    executions: log.slice(offset, offset + limit),
  };
}

function getExecution(executionId) {
  // Search in global log (has all executions)
  const globalState = getOrgState(null);
  return globalState.executionLog.find(e => e.id === executionId) || null;
}

// ── Ring buffer for execution log (keep last 100) ──
function addToLog(state, execution) {
  state.executionLog.push(execution);
  if (state.executionLog.length > 100) {
    state.executionLog.shift();
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  processAlert,
  getStatus,
  setEnabled,
  toggleAction,
  toggleNotificationRule,
  getExecutionLog,
  getExecution,
  isActionEnabled,
  isNotifEnabled,
  REMEDIATION_ACTIONS,
  NOTIFICATION_RULES,
};
