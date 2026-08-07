// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Integration Controller
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
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
    const integration = await prisma.integration.create({ data: { ...req.body, organizationId: getCreateOrgId(req) } });
    return success(res, integration, 201);
  } catch (err) { next(err); }
}

// PATCH /api/v1/integrations/:id
async function updateIntegration(req, res, next) {
  try {
    const integration = await prisma.integration.update({
      where: { id: req.params.id }, data: req.body,
    });
    return success(res, integration);
  } catch (err) { next(err); }
}

// POST /api/v1/integrations/:id/test
async function testConnection(req, res, next) {
  try {
    const integration = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!integration) return error(res, 'Integration not found', 404);

    let testResult = { connected: false, message: '' };

    switch (integration.type) {
      case 'PROMETHEUS': {
        const url = config.observability.prometheusUrl;
        if (!url) { testResult.message = 'Prometheus URL not configured'; break; }
        const resp = await axios.get(`${url}/api/v1/status/runtimeinfo`, { timeout: 5000 });
        testResult = { connected: true, message: 'Prometheus reachable', version: resp.data?.data?.version };
        break;
      }
      case 'GRAFANA': {
        const url = config.observability.grafanaUrl;
        if (!url) { testResult.message = 'Grafana URL not configured'; break; }
        const resp = await axios.get(`${url}/api/health`, { timeout: 5000 });
        testResult = { connected: resp.data?.database === 'ok', message: resp.data?.database === 'ok' ? 'Grafana healthy' : 'Grafana unhealthy' };
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

module.exports = { listIntegrations, getIntegration, createIntegration, updateIntegration, testConnection };
