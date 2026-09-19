// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Integration Controller
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const crypto = require('crypto');
const { isPlatformAdmin, stripTenantFields } = require('../middleware/tenant');
const { checkIntegrationConfig } = require('../utils/integrationGuard');
const { prisma } = require('../config/database');
const { config } = require('../config/env');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');

// GET /api/v1/integrations
async function listIntegrations(req, res, next) {
  try {
    const tw = req.tenantWhere || {};
    const integrations = await prisma.integration.findMany({
      where: { ...tw },
      orderBy: { name: 'asc' },
      include: { webhooks: true },
    });
    return success(res, integrations);
  } catch (err) { next(err); }
}

// GET /api/v1/integrations/:id
async function getIntegration(req, res, next) {
  try {
    const integration = await prisma.integration.findUnique({
      where: { id: req.params.id },
      include: { webhooks: true },
    });
    if (!integration) return error(res, 'Integration not found', 404);
    if (req.tenantWhere?.organizationId && integration.organizationId !== req.tenantWhere.organizationId) return error(res, 'Integration not found', 404);
    return success(res, integration);
  } catch (err) { next(err); }
}

// POST /api/v1/integrations
async function createIntegration(req, res, next) {
  try {
    const { getCreateOrgId } = require('../middleware/tenant');
    const bad = await checkIntegrationConfig(req.body.config, { platformAdmin: isPlatformAdmin(req.user) });
    if (bad) return error(res, bad, 400);
    const integration = await prisma.integration.create({ data: { ...stripTenantFields(req.body), organizationId: getCreateOrgId(req) } });
    return success(res, integration, 201);
  } catch (err) { next(err); }
}

// Load an integration only if it belongs to the caller's tenant scope, so an
// id from another organization reads as not found.
function findScopedIntegration(req) {
  return prisma.integration.findFirst({ where: { ...(req.tenantWhere || {}), id: req.params.id } });
}

// PATCH /api/v1/integrations/:id
async function updateIntegration(req, res, next) {
  try {
    const current = await findScopedIntegration(req);
    if (!current) return error(res, 'Integration not found', 404);
    const bad = await checkIntegrationConfig(req.body.config, {
      platformAdmin: isPlatformAdmin(req.user), existing: current.config,
    });
    if (bad) return error(res, bad, 400);
    // Never let the body move the record to another org or rewrite its key.
    const data = stripTenantFields(req.body);
    const integration = await prisma.integration.update({
      where: { id: req.params.id }, data,
    });
    return success(res, integration);
  } catch (err) { next(err); }
}

// POST /api/v1/integrations/:id/test
async function testConnection(req, res, next) {
  try {
    const integration = await findScopedIntegration(req);
    if (!integration) return error(res, 'Integration not found', 404);

    let testResult = { connected: false, message: '' };

    switch (integration.type) {
      case 'PROMETHEUS': {
        let cfg = {};
        try { cfg = integration.config ? JSON.parse(integration.config) : {}; } catch (_) { /* ignore */ }
        const url = (cfg.prometheusUrl || config.observability.prometheusUrl || '').replace(/\/+$/, '');
        if (!url) { testResult.message = 'Prometheus URL not configured'; break; }
        // VictoriaMetrics / Prometheus-compatible health checks
        let ok = false;
        let detail = '';
        for (const path of ['/-/healthy', '/health', '/api/v1/query?query=up']) {
          try {
            const resp = await axios.get(`${url}${path.startsWith('/') ? path : `/${path}`}`, { timeout: 5000, validateStatus: () => true });
            if (resp.status >= 200 && resp.status < 300) {
              ok = true;
              detail = path;
              break;
            }
            detail = `${path} → HTTP ${resp.status}`;
          } catch (e) {
            detail = `${path} → ${e.message}`;
          }
        }
        testResult = ok
          ? { connected: true, message: `Prometheus reachable at ${url}`, endpoint: detail }
          : { connected: false, message: `Prometheus unreachable at ${url} (${detail})` };
        break;
      }
      case 'GRAFANA': {
        let cfg = {};
        try { cfg = integration.config ? JSON.parse(integration.config) : {}; } catch (_) { /* ignore */ }
        const url = (cfg.grafanaExternalUrl || config.observability.grafanaUrl || '').replace(/\/+$/, '');
        if (!url) { testResult.message = 'Grafana URL not configured'; break; }
        const headers = cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {};
        const resp = await axios.get(`${url}/api/health`, { headers, timeout: 5000 });
        testResult = { connected: resp.data?.database === 'ok', message: resp.data?.database === 'ok' ? `Grafana healthy (${resp.data?.version || 'ok'})` : 'Grafana unhealthy', version: resp.data?.version };
        break;
      }
      case 'LOKI': {
        const url = config.observability.lokiUrl;
        if (!url) { testResult.message = 'Loki URL not configured'; break; }
        const resp = await axios.get(`${url}/ready`, { timeout: 5000 });
        testResult = { connected: resp.status === 200, message: 'Loki ready' };
        break;
      }
      case 'SLACK': {
        if (!config.slack.botToken) { testResult.message = 'Slack bot token not configured'; break; }
        const resp = await axios.get('https://slack.com/api/auth.test', {
          headers: { Authorization: `Bearer ${config.slack.botToken}` }, timeout: 5000,
        });
        testResult = { connected: resp.data?.ok, message: resp.data?.ok ? `Connected as ${resp.data.user}` : resp.data?.error };
        break;
      }
      case 'TWILIO': {
        const { accountSid, authToken } = config.twilio;
        if (!accountSid) { testResult.message = 'Twilio credentials not configured'; break; }
        const resp = await axios.get(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
          { auth: { username: accountSid, password: authToken }, timeout: 5000 }
        );
        testResult = { connected: resp.data?.status === 'active', message: `Twilio account: ${resp.data?.friendly_name || resp.data?.status}` };
        break;
      }
      case 'MSG91': {
        if (!config.msg91.apiKey) { testResult.message = 'MSG91 API key not configured'; break; }
        testResult = { connected: true, message: `MSG91 configured (sender: ${config.msg91.senderId})` };
        break;
      }
      case 'KALEYRA': {
        if (!config.kaleyra.apiKey) { testResult.message = 'Kaleyra API key not configured'; break; }
        testResult = { connected: true, message: `Kaleyra configured (sender: ${config.kaleyra.senderId})` };
        break;
      }
      default:
        testResult.message = `Test not implemented for ${integration.type}`;
    }

    const newStatus = testResult.connected ? 'ACTIVE' : 'ERROR';
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: newStatus, lastSyncAt: new Date(), syncStatus: testResult.message, errorMessage: testResult.connected ? null : testResult.message },
    });

    logger.info(`Integration test: ${integration.name} — ${testResult.connected ? 'OK' : 'FAIL'}`);
    return success(res, testResult);
  } catch (err) {
    await prisma.integration.update({
      where: { id: req.params.id },
      data: { status: 'ERROR', errorMessage: err.message },
    }).catch(() => {});
    next(err);
  }
}

// ── Inbound alert webhook token (per org) ──────────────────
// Senders append ?token=<value> to /api/v1/webhooks/{alertmanager,grafana};
// the token alone decides the org. ADMIN of the org (or a platform admin who
// has selected one) may read it; rotating invalidates every configured sender.

function alertWebhookOrgId(req) {
  return req.organizationId || null; // resolved by authenticate(); null = no single org selected
}

async function ensureAlertWebhookToken(orgId, rotate) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { alertWebhookToken: true } });
  if (!org) return null;
  if (org.alertWebhookToken && !rotate) return org.alertWebhookToken;
  const token = `whk_${crypto.randomBytes(24).toString('hex')}`;
  await prisma.organization.update({ where: { id: orgId }, data: { alertWebhookToken: token } });
  return token;
}

// GET /api/v1/integrations/alert-webhook
async function getAlertWebhook(req, res, next) {
  try {
    const orgId = alertWebhookOrgId(req);
    if (!orgId) return error(res, 'Select an organization first', 400);
    const token = await ensureAlertWebhookToken(orgId, false);
    if (!token) return error(res, 'Organization not found', 404);
    return success(res, { token, paths: ['/api/v1/webhooks/alertmanager', '/api/v1/webhooks/grafana'] });
  } catch (err) { next(err); }
}

// POST /api/v1/integrations/alert-webhook/rotate
async function rotateAlertWebhook(req, res, next) {
  try {
    const orgId = alertWebhookOrgId(req);
    if (!orgId) return error(res, 'Select an organization first', 400);
    const token = await ensureAlertWebhookToken(orgId, true);
    if (!token) return error(res, 'Organization not found', 404);
    logger.info(`[integrations] alert webhook token rotated for org ${orgId} by ${req.user.email}`);
    return success(res, { token });
  } catch (err) { next(err); }
}

module.exports = {
  listIntegrations, getIntegration, createIntegration, updateIntegration, testConnection,
  getAlertWebhook, rotateAlertWebhook,
};
