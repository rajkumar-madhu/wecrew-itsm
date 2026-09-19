// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — PagerDuty Controller
// Multi-tenant: org's PD integration config drives all calls
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const { prisma } = require('../config/database');
const { success, error } = require('../utils/helpers');
const pd = require('../services/pagerdutyService');
const logger = require('../utils/logger');

// ── Resolve org's PagerDuty integration config ────────────
// No org → no config. The old fallback (no org filter) handed a caller with no
// organization — or a platform admin viewing "all" — whichever org's
// PagerDuty API key came first.
async function resolvePdConfig(orgId) {
  if (!orgId) return null;
  const integration = await prisma.integration.findFirst({
    where: { organizationId: orgId, type: 'PAGERDUTY', status: 'ACTIVE' },
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
    if (!req.organizationId) return error(res, 'Select an organization first', 400);

    // Validate key first
    const validation = await pd.validateApiKey(apiKey.trim());
    if (!validation.valid) return error(res, validation.error || 'Invalid API key', 400);

    // Upsert integration
    const existing = await prisma.integration.findFirst({
      where: { organizationId: req.organizationId, type: 'PAGERDUTY' },
    });
    let previous = {};
    try { previous = existing?.config ? JSON.parse(existing.config) : {}; } catch { /* regenerate */ }

    const config = JSON.stringify({
      // Secret for this org's webhook URL (see handleWebhook). Kept across
      // reconnects so the URL configured in PagerDuty keeps working.
      webhookToken: previous.webhookToken || crypto.randomBytes(24).toString('hex'),
      apiKey: apiKey.trim(),
      routingKey: routingKey?.trim() || '',
      serviceId: serviceId?.trim() || '',
      autoSync: !!autoSync,
      autoCreateIncidents: !!autoCreateIncidents,
      connectedAt: new Date().toISOString(),
      accountName: validation.account?.name,
      accountEmail: validation.account?.email,
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
          organizationId: req.organizationId,
        },
      });
    }

    return success(res, {
      integrationId: integration.id,
      account: validation.account,
      // Configure this URL in PagerDuty; the token identifies and authenticates the org.
      webhookUrl: `/api/v1/pagerduty/webhook?token=${JSON.parse(config).webhookToken}`,
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
/**
 * Find the org whose PagerDuty integration owns this webhook token, comparing
 * in constant time. `contains` only narrows candidates; equality is decided
 * on the parsed config.
 */
async function findIntegrationByWebhookToken(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token)) return null;
  const candidates = await prisma.integration.findMany({
    where: { type: 'PAGERDUTY', status: 'ACTIVE', config: { contains: token } },
    select: { id: true, config: true, organizationId: true },
    take: 5,
  });
  const want = Buffer.from(token);
  return candidates.find((c) => {
    try {
      const got = Buffer.from(String(JSON.parse(c.config).webhookToken || ''));
      return got.length === want.length && crypto.timingSafeEqual(got, want);
    } catch { return false; }
  }) || null;
}

async function handleWebhook(req, res) {
  try {
    // Unauthenticated route: the per-org token in the URL is the only proof of
    // origin, and it also pins which org's incidents this event may touch.
    const owner = await findIntegrationByWebhookToken(req.query.token);
    if (!owner || !owner.organizationId) {
      logger.warn('[PagerDuty] Webhook rejected: missing or unknown token');
      return res.status(401).json({ received: false });
    }

    const event = pd.parseWebhookEvent(req.body);
    if (!event) return res.status(200).json({ received: true });

    logger.info('[PagerDuty] Webhook: %s', event.type || JSON.stringify(event).slice(0, 80));

    // Handle incident events — sync back to WeCrew
    const incident = event.incident;
    if (incident?.id && event.type) {
      const eventType = event.type; // incident.triggered, incident.acknowledged, incident.resolved

      if (eventType === 'incident.resolved' && incident.id) {
        // Find matching WeCrew incident by pagerduty incident id in labels/source
        // Only this org's incidents; an empty title would match everything.
        const linkedIncident = incident.title ? await prisma.incident.findFirst({
          where: {
            organizationId: owner.organizationId,
            source: 'API',
            shortDescription: { contains: incident.title },
            state: { in: ['NEW', 'IN_PROGRESS'] },
          },
        }) : null;
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
