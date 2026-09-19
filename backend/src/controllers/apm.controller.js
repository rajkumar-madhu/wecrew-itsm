// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — APM Controller
// Resolves org's monitoring config → real Prometheus metrics
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error } = require('../utils/helpers');
const apm = require('../services/apmService');
const logger = require('../utils/logger');

// ── Shell-safe config values ──────────────────────────────
// apmService interpolates these into a local `ssh … "cmd"` line run through
// exec. Org admins can write integration config, so any value outside a
// strict charset is dropped (falls back to the default), never escaped.
const SAFE_HOST = /^[A-Za-z0-9][A-Za-z0-9.:-]{0,252}$/; // no leading '-' (ssh option injection)
const SAFE_USER = /^[A-Za-z_][A-Za-z0-9_.-]{0,31}$/;
const SAFE_TOKEN = /^[A-Za-z0-9._~@%+=:,*-]{0,128}$/;   // no quotes, spaces, $, `, ;, |, &

function safeStr(re, v, fallback) {
  return typeof v === 'string' && re.test(v) ? v : fallback;
}
function safePort(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

// ── Resolve org's full monitoring config ──────────────────

async function resolveApmConfig(orgId) {
  // No org (a platform admin viewing all orgs, or a user without one): there
  // is no single org's config to use. Without this, the unfiltered findFirst
  // below returned whichever org's integration came first.
  // PROMETHEUS or KUBERNETES_CLUSTER integration → SSH + Prometheus access
  const integration = !orgId ? null : await prisma.integration.findFirst({
    where: {
      organizationId: orgId,
      status: 'ACTIVE',
      type: { in: ['PROMETHEUS', 'KUBERNETES_CLUSTER'] },
    },
    select: { id: true, config: true, organizationId: true, type: true },
  });

  let baseConfig = {};
  if (integration?.config) {
    try { baseConfig = JSON.parse(integration.config); } catch (e) { logger.warn('Failed to parse integration config: %s', e.message); }
  }

  // STACKSTORM integration → APM-specific config (subsites, processDefinitions, redis)
  const apmInt = !orgId ? null : await prisma.integration.findFirst({
    where: { organizationId: orgId, type: 'STACKSTORM', status: 'ACTIVE' },
    select: { config: true },
  });
  let apmExtra = {};
  if (apmInt?.config) {
    try { apmExtra = JSON.parse(apmInt.config); } catch (e) { logger.warn('Failed to parse APM config: %s', e.message); }
  }

  // Get org details
  const org = orgId ? await prisma.organization.findUnique({
    where: { id: orgId }, select: { id: true, slug: true, name: true, environment: true, serverIp: true, fqdn: true },
  }) : null;

  return {
    // SSH connectivity
    serverIp: safeStr(SAFE_HOST, baseConfig.serverIp || org?.serverIp, null),
    sshPort: safePort(baseConfig.sshPort, 4422),
    sshUser: safeStr(SAFE_USER, baseConfig.sshUser, 'finadmin'),
    promPort: safePort(baseConfig.promPort, 30000),
    // Redis
    redisHost: safeStr(SAFE_HOST, apmExtra.redisHost || baseConfig.redisHost, 'localhost'),
    redisPort: safePort(apmExtra.redisPort || baseConfig.redisPort, 6379),
    redisPass: safeStr(SAFE_TOKEN, apmExtra.redisPass || baseConfig.redisPass, ''),
    // APM
    siteName: org?.slug || 'prod',
    subsiteNames: apmExtra.subsites || baseConfig.subsites || [],
    adpPattern: safeStr(SAFE_TOKEN, apmExtra.adpPattern, '*:ADP:*') || '*:ADP:*',
    processDefinitions: apmExtra.processDefinitions || {},
    sites: (Array.isArray(apmExtra.sites) ? apmExtra.sites : [org?.slug || 'prod'])
      .filter((x) => typeof x === 'string' && x && SAFE_TOKEN.test(x)),
    // Org metadata for frontend
    orgName: org?.name || null,
    orgSlug: org?.slug || null,
    orgEnvironment: org?.environment || null,
    orgFqdn: org?.fqdn || null,
    orgServerIp: org?.serverIp || null,
  };
}

// ── GET /api/v1/apm/overview ────────────────────────────
// Full overview: processes + infrastructure + k8s + alerts

async function getOverview(req, res, next) {
  try {
    const cfg = await resolveApmConfig(req.organizationId);

    const [procResult, urlResult, infraResult, k8sResult, alertResult, netResult, svcResult] = await Promise.allSettled([
      apm.getProcessStatus(cfg),
      apm.getUrlCheckerStatus(cfg),
      apm.getInfrastructureMetrics(cfg),
      apm.getK8sHealth(cfg),
      apm.getActiveAlerts(cfg),
      apm.getNetworkInterfaces(cfg),
      apm.getServiceHealth(cfg),
    ]);

    const procData = procResult.status === 'fulfilled' ? procResult.value : { simulated: true, subsites: [] };
    const urlData = urlResult.status === 'fulfilled' ? urlResult.value : { simulated: true, sites: [] };
    const infraData = infraResult.status === 'fulfilled' ? infraResult.value : { simulated: true, metrics: null };
    const k8sData = k8sResult.status === 'fulfilled' ? k8sResult.value : { simulated: true, k8s: null };
    const alertData = alertResult.status === 'fulfilled' ? alertResult.value : { simulated: true, alerts: [] };
    const netData = netResult.status === 'fulfilled' ? netResult.value : { simulated: true, interfaces: [] };
    const svcData = svcResult.status === 'fulfilled' ? svcResult.value : { simulated: true, services: [] };

    const summary = apm.computeSummary(procData.subsites);

    return success(res, {
      org: { name: cfg.orgName, slug: cfg.orgSlug, environment: cfg.orgEnvironment, fqdn: cfg.orgFqdn, serverIp: cfg.orgServerIp },
      processes: procData,
      urls: urlData,
      infrastructure: infraData,
      k8s: k8sData,
      alerts: alertData,
      network: netData,
      services: svcData,
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
}

// ── GET /api/v1/apm/process-status ──────────────────────

async function getProcessStatus(req, res, next) {
  try {
    const cfg = await resolveApmConfig(req.organizationId);
    const result = await apm.getProcessStatus(cfg);
    const summary = apm.computeSummary(result.subsites);
    return success(res, { ...result, summary, org: { name: cfg.orgName, slug: cfg.orgSlug }, generatedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

// ── GET /api/v1/apm/url-status ──────────────────────────

async function getUrlStatus(req, res, next) {
  try {
    const cfg = await resolveApmConfig(req.organizationId);
    const result = await apm.getUrlCheckerStatus(cfg);
    return success(res, { ...result, generatedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

// ── GET /api/v1/apm/infra-metrics ───────────────────────

async function getInfraMetrics(req, res, next) {
  try {
    const cfg = await resolveApmConfig(req.organizationId);
    const result = await apm.getInfrastructureMetrics(cfg);
    return success(res, { ...result, org: { name: cfg.orgName, slug: cfg.orgSlug }, generatedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

// ── GET /api/v1/apm/network ─────────────────────────────

async function getNetworkStatus(req, res, next) {
  try {
    const cfg = await resolveApmConfig(req.organizationId);
    const result = await apm.getNetworkInterfaces(cfg);
    return success(res, { ...result, generatedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

// ── GET /api/v1/apm/k8s-health ──────────────────────────

async function getK8sHealth(req, res, next) {
  try {
    const cfg = await resolveApmConfig(req.organizationId);
    const result = await apm.getK8sHealth(cfg);
    return success(res, { ...result, generatedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

// ── GET /api/v1/apm/services ────────────────────────────

async function getServiceHealthCtrl(req, res, next) {
  try {
    const cfg = await resolveApmConfig(req.organizationId);
    const result = await apm.getServiceHealth(cfg);
    return success(res, { ...result, generatedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

// ── GET /api/v1/apm/active-alerts ───────────────────────

async function getActiveAlerts(req, res, next) {
  try {
    const cfg = await resolveApmConfig(req.organizationId);
    const result = await apm.getActiveAlerts(cfg);
    return success(res, { ...result, generatedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

// ── POST /api/v1/apm/annotations ────────────────────────

async function addAnnotation(req, res, next) {
  try {
    const { processKey, subsite, processName, message, statusCode } = req.body;
    if (!processKey || !message) return error(res, 'processKey and message are required', 400);
    const annotation = {
      id: `annot-${Date.now()}`, processKey, subsite, processName, message, statusCode,
      createdBy: req.user?.email || 'system',
      createdAt: new Date().toISOString(),
      organizationId: req.organizationId,
    };
    logger.info('[APM] Annotation added: %s - %s', processKey, message);
    return success(res, annotation, 201);
  } catch (err) { next(err); }
}

module.exports = {
  getProcessStatus, getUrlStatus, getOverview, addAnnotation,
  getInfraMetrics, getNetworkStatus, getK8sHealth: getK8sHealth,
  getServiceHealth: getServiceHealthCtrl, getActiveAlerts,
};
