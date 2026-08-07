// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — PagerDuty Controller
// Multi-tenant: org's PD integration config drives all calls
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error } = require('../utils/helpers');
const pd = require('../services/pagerdutyService');
const logger = require('../utils/logger');

// ── Resolve org's PagerDuty integration config ────────────
async function resolvePdConfig(orgId) {
  const where = orgId ? { organizationId: orgId, type: 'PAGERDUTY', status: 'ACTIVE' }
                      : { type: 'PAGERDUTY', status: 'ACTIVE' };
  const integration = await prisma.integration.findFirst({
    where,
    select: { id: true, config: true, organizationId: true },
  });
  if (!integration?.config) return null;
  try {
    const cfg = JSON.parse(integration.config);
    return { ...cfg, integrationId: integration.id, organizationId: integration.organizationId };
  } catch { return null; }
}

// POST /api/v1/pagerduty/validate
// Body: { apiKey, routingKey? }
async function validate(req, res, next) {
  try {
    const { apiKey } = req.body;
    if (!apiKey?.trim()) return error(res, 'apiKey is required', 400);
    const result = await pd.validateApiKey(apiKey.trim());
    return success(res, result);
  } catch (err) { next(err); }
}

// POST /api/v1/pagerduty/connect
// Body: { apiKey, routingKey, serviceId?, autoSync?, autoCreateIncidents? }
// Creates/updates the PAGERDUTY integration for the org
async function connect(req, res, next) {
  try {
    const { apiKey, routingKey, serviceId, autoSync = true, autoCreateIncidents = true } = req.body;
    if (!apiKey?.trim()) return error(res, 'apiKey is required', 400);

    // Validate key first
    const validation = await pd.validateApiKey(apiKey.trim());
    if (!validation.valid) return error(res, validation.error || 'Invalid API key', 400);

    const config = JSON.stringify({
      apiKey: apiKey.trim(),
      routingKey: routingKey?.trim() || '',
      serviceId: serviceId?.trim() || '',
      autoSync: !!autoSync,
      autoCreateIncidents: !!autoCreateIncidents,
      connectedAt: new Date().toISOString(),
      accountName: validation.account?.name,
      accountEmail: validation.account?.email,
    });

    // Upsert integration
    const existing = await prisma.integration.findFirst({
      where: { organizationId: req.organizationId || null, type: 'PAGERDUTY' },
    });

    let integration;
    if (existing) {
      integration = await prisma.integration.update({
        where: { id: existing.id },
        data: { config, status: 'ACTIVE', name: `PagerDuty — ${validation.account.name}` },
      });
    } else {
      integration = await prisma.integration.create({
        data: {
          name: `PagerDuty — ${validation.account.name}`,
          type: 'PAGERDUTY',
          status: 'ACTIVE',
          config,
          organizationId: req.organizationId || null,
        },
      });
    }

    return success(res, {
      integrationId: integration.id,
      account: validation.account,
      message: 'PagerDuty connected successfully',
    });
  } catch (err) { next(err); }
}

// DELETE /api/v1/pagerduty/disconnect
async function disconnect(req, res, next) {
  try {
    const cfg = await resolvePdConfig(req.organizationId);
    if (!cfg) return error(res, 'No PagerDuty integration found', 404);
    await prisma.integration.update({
      where: { id: cfg.integrationId },
      data: { status: 'INACTIVE' },
    });
    return success(res, { message: 'PagerDuty disconnected' });
  } catch (err) { next(err); }
}

// GET /api/v1/pagerduty/overview — full dashboard data
async function getOverview(req, res, next) {
  try {
    const cfg = await resolvePdConfig(req.organizationId);
    if (!cfg?.apiKey) return error(res, 'PagerDuty not connected', 404);
    const overview = await pd.getOverview(cfg.apiKey);
    return success(res, { ...overview, config: { autoSync: cfg.autoSync, autoCreateIncidents: cfg.autoCreateIncidents, accountName: cfg.accountName, accountEmail: cfg.accountEmail } });
  } catch (err) { next(err); }
}

// GET /api/v1/pagerduty/services
async function getServices(req, res, next) {
  try {
    const cfg = await resolvePdConfig(req.organizationId);
    if (!cfg?.apiKey) return error(res, 'PagerDuty not connected', 404);
    const services = await pd.getServices(cfg.apiKey);
    return success(res, services);
  } catch (err) { next(err); }
}

// GET /api/v1/pagerduty/incidents
async function getIncidents(req, res, next) {
  try {
    const cfg = await resolvePdConfig(req.organizationId);
    if (!cfg?.apiKey) return error(res, 'PagerDuty not connected', 404);
    const statuses = req.query.status ? [req.query.status] : ['triggered', 'acknowledged'];
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = parseInt(req.query.offset) || 0;
    const result = await pd.getIncidents(cfg.apiKey, { statuses, limit, offset, serviceId: req.query.serviceId });
    return success(res, result);
  } catch (err) { next(err); }
}

// GET /api/v1/pagerduty/oncall
async function getOnCalls(req, res, next) {
  try {
    const cfg = await resolvePdConfig(req.organizationId);
    if (!cfg?.apiKey) return error(res, 'PagerDuty not connected', 404);
    const onCalls = await pd.getOnCalls(cfg.apiKey);
    return success(res, onCalls);
  } catch (err) { next(err); }
}

// GET /api/v1/pagerduty/escalation-policies
async function getEscalationPolicies(req, res, next) {
  try {
    const cfg = await resolvePdConfig(req.organizationId);
    if (!cfg?.apiKey) return error(res, 'PagerDuty not connected', 404);
    const policies = await pd.getEscalationPolicies(cfg.apiKey);
    return success(res, policies);
  } catch (err) { next(err); }
}

// GET /api/v1/pagerduty/users
async function getUsers(req, res, next) {
  try {
    const cfg = await resolvePdConfig(req.organizationId);
    if (!cfg?.apiKey) return error(res, 'PagerDuty not connected', 404);
    const users = await pd.getUsers(cfg.apiKey);
    return success(res, users);
  } catch (err) { next(err); }
}

// GET /api/v1/pagerduty/stats
async function getStats(req, res, next) {
  try {
    const cfg = await resolvePdConfig(req.organizationId);
    if (!cfg?.apiKey) return error(res, 'PagerDuty not connected', 404);
    const stats = await pd.getIncidentStats(cfg.apiKey);
    return success(res, stats);
  } catch (err) { next(err); }
}

// POST /api/v1/pagerduty/webhook — receive PD V3 webhooks
async function handleWebhook(req, res) {
  try {
    const event = pd.parseWebhookEvent(req.body);
    if (!event) return res.status(200).json({ received: true });

    logger.info('[PagerDuty] Webhook: %s', event.type || JSON.stringify(event).slice(0, 80));

    // Handle incident events — sync back to LinkedEye
    const incident = event.incident;
    if (incident?.id && event.type) {
      const eventType = event.type; // incident.triggered, incident.acknowledged, incident.resolved

      if (eventType === 'incident.resolved' && incident.id) {
        // Find matching LinkedEye incident by pagerduty incident id in labels/source
        const linkedIncident = await prisma.incident.findFirst({
          where: { source: 'API', title: { contains: incident.title || '' }, state: { in: ['NEW', 'IN_PROGRESS'] } },
        });
        if (linkedIncident) {
          await prisma.incident.update({
            where: { id: linkedIncident.id },
            data: { state: 'RESOLVED', resolvedAt: new Date() },
          });
          logger.info('[PagerDuty] Auto-resolved incident %s from PD webhook', linkedIncident.number);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error('[PagerDuty] Webhook error: %s', err.message);
    return res.status(200).json({ received: true }); // always 200 to PD
  }
}

// GET /api/v1/pagerduty/status — is integration connected?
async function getStatus(req, res, next) {
  try {
    const cfg = await resolvePdConfig(req.organizationId);
    if (!cfg?.apiKey) return success(res, { connected: false });
    // Quick ping to verify key still valid
    const check = await pd.validateApiKey(cfg.apiKey);
    return success(res, {
      connected: check.valid,
      account: check.valid ? check.account : null,
      accountName: cfg.accountName,
      accountEmail: cfg.accountEmail,
      autoSync: cfg.autoSync,
      autoCreateIncidents: cfg.autoCreateIncidents,
      connectedAt: cfg.connectedAt,
      error: check.valid ? null : check.error,
    });
  } catch (err) { next(err); }
}

module.exports = {
  validate,
  connect,
  disconnect,
  getOverview,
  getServices,
  getIncidents,
  getOnCalls,
  getEscalationPolicies,
  getUsers,
  getStats,
  handleWebhook,
  getStatus,
};
