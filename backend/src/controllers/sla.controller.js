// ═══════════════════════════════════════════════════════════
// Argus ITSM — SLA Policy Controller
// ═══════════════════════════════════════════════════════════

const { success, error } = require('../utils/helpers');
const { PRIORITIES } = require('../config/constants');
const slaPolicy = require('../services/slaPolicyService');
const logger = require('../utils/logger');
const { isPlatformAdmin } = require('../middleware/tenant');

const MAX_MINUTES = 60 * 24 * 90; // 90 days

// With no org in scope a write targets the platform-wide policy, which every tenant
// inherits — only platform admins may do that.
function denyPlatformWrite(req, res) {
  if (req.organizationId || isPlatformAdmin(req.user)) return false;
  error(res, 'Select an organization before changing SLA policies', 403);
  return true;
}

// GET /api/v1/sla — effective policy per priority for the current tenant
async function listPolicies(req, res) {
  try {
    const policies = await slaPolicy.getEffectivePolicies(req.organizationId || null);
    return success(res, { organizationId: req.organizationId || null, policies });
  } catch (err) {
    logger.error('listPolicies failed:', err);
    return error(res, 'Failed to load SLA policies', 500);
  }
}

// PUT /api/v1/sla/:priority — set targets for the current tenant
// (super-admin with no org selected edits the platform-wide policy)
async function updatePolicy(req, res) {
  try {
    if (denyPlatformWrite(req, res)) return;
    const priority = String(req.params.priority || '').toUpperCase();
    if (!PRIORITIES.includes(priority)) return error(res, `Priority must be one of ${PRIORITIES.join(', ')}`, 400);

    const response = Number(req.body.responseTimeMinutes);
    const resolution = Number(req.body.resolutionTimeMinutes);
    if (!Number.isInteger(response) || response < 1 || response > MAX_MINUTES) {
      return error(res, 'Response time must be a whole number of minutes between 1 and 129600', 400);
    }
    if (!Number.isInteger(resolution) || resolution < 1 || resolution > MAX_MINUTES) {
      return error(res, 'Resolution time must be a whole number of minutes between 1 and 129600', 400);
    }
    if (resolution < response) return error(res, 'Resolution time cannot be shorter than response time', 400);

    const { businessHoursOnly, name } = req.body;
    if (businessHoursOnly !== undefined && typeof businessHoursOnly !== 'boolean') {
      return error(res, 'businessHoursOnly must be true or false', 400);
    }

    await slaPolicy.upsertPolicy(req.organizationId || null, priority, {
      responseTimeMinutes: response,
      resolutionTimeMinutes: resolution,
      businessHoursOnly,
      name: typeof name === 'string' ? name.slice(0, 100) : undefined,
    });
    const policies = await slaPolicy.getEffectivePolicies(req.organizationId || null);
    return success(res, { organizationId: req.organizationId || null, policies });
  } catch (err) {
    logger.error('updatePolicy failed:', err);
    return error(res, 'Failed to update SLA policy', 500);
  }
}

// DELETE /api/v1/sla/:priority — drop the tenant's override
async function resetPolicy(req, res) {
  try {
    if (denyPlatformWrite(req, res)) return;
    const priority = String(req.params.priority || '').toUpperCase();
    if (!PRIORITIES.includes(priority)) return error(res, `Priority must be one of ${PRIORITIES.join(', ')}`, 400);
    await slaPolicy.resetPolicy(req.organizationId || null, priority);
    const policies = await slaPolicy.getEffectivePolicies(req.organizationId || null);
    return success(res, { organizationId: req.organizationId || null, policies });
  } catch (err) {
    logger.error('resetPolicy failed:', err);
    return error(res, 'Failed to reset SLA policy', 500);
  }
}

module.exports = { listPolicies, updatePolicy, resetPolicy };
