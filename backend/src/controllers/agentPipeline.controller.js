// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Agent Pipeline Controller (API Layer)
// Manages AI Agent Pipeline status, actions, executions
// Multi-Tenant: threads req.organizationId into all service calls
// ═══════════════════════════════════════════════════════════

const { success, error } = require('../utils/helpers');
const pipeline = require('../services/agentPipeline');
const { isPlatformAdmin, inScope } = require('../middleware/tenant');

// A null org id means the GLOBAL pipeline: its state is shared by everyone and
// its log holds every org's executions. Only platform staff may use it; any
// other caller without an organization gets nothing.
function lacksOrg(req) {
  return !req.organizationId && !isPlatformAdmin(req.user);
}
const NO_ORG = 'No organization on this account';

// GET /api/v1/agent/status — Full pipeline status + config (org-scoped)
async function getStatus(req, res, next) {
  try {
    if (lacksOrg(req)) return error(res, NO_ORG, 400);
    const status = pipeline.getStatus(req.organizationId);
    return success(res, status);
  } catch (err) { next(err); }
}

// POST /api/v1/agent/toggle — Enable/disable pipeline (org-scoped)
async function togglePipeline(req, res, next) {
  try {
    if (lacksOrg(req)) return error(res, NO_ORG, 400);
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return error(res, 'enabled (boolean) is required', 400);
    const result = pipeline.setEnabled(req.organizationId, enabled);
    return success(res, { enabled: result });
  } catch (err) { next(err); }
}

// POST /api/v1/agent/actions/:actionId/toggle — Enable/disable action (org-scoped)
async function toggleAction(req, res, next) {
  try {
    if (lacksOrg(req)) return error(res, NO_ORG, 400);
    const { actionId } = req.params;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return error(res, 'enabled (boolean) is required', 400);
    const action = pipeline.toggleAction(req.organizationId, actionId, enabled);
    if (!action) return error(res, 'Action not found', 404);
    return success(res, action);
  } catch (err) { next(err); }
}

// POST /api/v1/agent/notifications/:ruleId/toggle — Enable/disable notification rule (org-scoped)
async function toggleNotification(req, res, next) {
  try {
    if (lacksOrg(req)) return error(res, NO_ORG, 400);
    const { ruleId } = req.params;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return error(res, 'enabled (boolean) is required', 400);
    const rule = pipeline.toggleNotificationRule(req.organizationId, ruleId, enabled);
    if (!rule) return error(res, 'Notification rule not found', 404);
    return success(res, rule);
  } catch (err) { next(err); }
}

// GET /api/v1/agent/executions — Execution log (org-scoped)
async function getExecutions(req, res, next) {
  try {
    if (lacksOrg(req)) return error(res, NO_ORG, 400);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const log = pipeline.getExecutionLog(req.organizationId, limit, offset);
    return success(res, log);
  } catch (err) { next(err); }
}

// GET /api/v1/agent/executions/:id — Single execution detail
async function getExecution(req, res, next) {
  try {
    // The lookup searches the global log (every org), so check ownership.
    const execution = pipeline.getExecution(req.params.id);
    if (!inScope(req, execution)) return error(res, 'Execution not found', 404);
    return success(res, execution);
  } catch (err) { next(err); }
}

// GET /api/v1/agent/actions — List all remediation actions (with org-scoped enabled flags)
async function listActions(req, res, next) {
  try {
    return success(res, pipeline.REMEDIATION_ACTIONS.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      category: a.category,
      targetSeverity: a.targetSeverity,
      matchAlerts: a.matchAlerts,
      enabled: pipeline.isActionEnabled(req.organizationId, a.id),
      commandCount: a.commands.length,
      hasVerification: !!a.verifyQuery,
    })));
  } catch (err) { next(err); }
}

// GET /api/v1/agent/notifications — List all notification rules (with org-scoped enabled flags)
async function listNotifications(req, res, next) {
  try {
    return success(res, pipeline.NOTIFICATION_RULES.map(r => ({
      id: r.id,
      name: r.name,
      severity: r.severity,
      event: r.event || null,
      channel: r.channel,
      enabled: pipeline.isNotifEnabled(req.organizationId, r.id),
    })));
  } catch (err) { next(err); }
}

module.exports = {
  getStatus,
  togglePipeline,
  toggleAction,
  toggleNotification,
  getExecutions,
  getExecution,
  listActions,
  listNotifications,
};
