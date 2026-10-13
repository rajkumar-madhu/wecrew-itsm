// ═══════════════════════════════════════════════════════════
// Argus ITSM — SLA Policy Controller
// ═══════════════════════════════════════════════════════════

const { success, error } = require('../utils/helpers');
const { PRIORITIES } = require('../config/constants');
const slaPolicy = require('../services/slaPolicyService');
const logger = require('../utils/logger');
const { isPlatformAdmin } = require('../middleware/tenant');
const { prisma } = require('../config/database');
const { validateSchedule, isValidTimeZone, DEFAULT_SCHEDULE } = require('../services/businessHours');

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

// GET /api/v1/sla/business-hours — the org's working calendar (or the default)
async function getBusinessHours(req, res) {
  try {
    if (!req.organizationId) return error(res, 'Select an organization to see its business hours', 400);
    const row = await prisma.businessHours.findUnique({ where: { organizationId: req.organizationId } });
    return success(res, row
      ? { configured: true, timezone: row.timezone, schedule: row.schedule, holidays: row.holidays }
      : { configured: false, timezone: 'Asia/Kolkata', schedule: DEFAULT_SCHEDULE, holidays: [] });
  } catch (err) {
    logger.error('getBusinessHours failed:', err);
    return error(res, 'Failed to load business hours', 500);
  }
}

// PUT /api/v1/sla/business-hours
async function updateBusinessHours(req, res) {
  try {
    if (!req.organizationId) return error(res, 'Select an organization before changing business hours', 400);
    const { timezone, schedule, holidays = [] } = req.body;
    if (!timezone || !isValidTimeZone(timezone)) return error(res, 'timezone must be an IANA name such as Asia/Kolkata', 400);
    const scheduleErr = validateSchedule(schedule);
    if (scheduleErr) return error(res, scheduleErr, 400);
    if (!Array.isArray(holidays) || holidays.length > 366 || holidays.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
      return error(res, 'holidays must be a list of YYYY-MM-DD dates', 400);
    }
    const data = { timezone, schedule, holidays: [...new Set(holidays)].sort() };
    const row = await prisma.businessHours.upsert({
      where: { organizationId: req.organizationId },
      create: { ...data, organizationId: req.organizationId },
      update: data,
    });
    slaPolicy.invalidateCalendar(req.organizationId);
    return success(res, { configured: true, timezone: row.timezone, schedule: row.schedule, holidays: row.holidays });
  } catch (err) {
    logger.error('updateBusinessHours failed:', err);
    return error(res, 'Failed to save business hours', 500);
  }
}

module.exports = { listPolicies, updatePolicy, resetPolicy, getBusinessHours, updateBusinessHours };
