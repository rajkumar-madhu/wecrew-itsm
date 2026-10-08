// ═══════════════════════════════════════════════════════════
// Argus ITSM — SLA Policy Service
// Resolves response/resolution targets from SLADefinition rows:
// org-specific policy → platform-wide policy (organizationId null) → SLA_DEFAULTS
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { SLA_DEFAULTS, PRIORITIES } = require('../config/constants');
const logger = require('../utils/logger');

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // key: orgId || '__global__' → { at, defs }

function cacheKey(organizationId) {
  return organizationId || '__global__';
}

function invalidate(organizationId) {
  if (organizationId === undefined) cache.clear();
  else cache.delete(cacheKey(organizationId));
}

// Active definitions that apply to an org: its own rows plus platform-wide rows
async function loadDefinitions(organizationId) {
  const key = cacheKey(organizationId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.defs;

  const defs = await prisma.sLADefinition.findMany({
    where: {
      isActive: true,
      OR: organizationId ? [{ organizationId }, { organizationId: null }] : [{ organizationId: null }],
    },
  });
  cache.set(key, { at: Date.now(), defs });
  return defs;
}

// Effective policy per priority, with where each value came from
async function getEffectivePolicies(organizationId) {
  const defs = await loadDefinitions(organizationId);
  return PRIORITIES.map((priority) => {
    const own = organizationId ? defs.find((d) => d.priority === priority && d.organizationId === organizationId) : null;
    const global = defs.find((d) => d.priority === priority && d.organizationId === null);
    const def = own || global;
    const fallback = SLA_DEFAULTS[priority];
    return {
      id: def?.id || null,
      priority,
      name: def?.name || `${priority} default`,
      responseTimeMinutes: def?.responseTimeMinutes ?? fallback.response,
      resolutionTimeMinutes: def?.resolutionTimeMinutes ?? fallback.resolution,
      businessHoursOnly: def?.businessHoursOnly ?? false,
      source: own ? 'organization' : global ? 'platform' : 'default',
    };
  });
}

async function resolveSLATargets(priority, organizationId) {
  const fallback = SLA_DEFAULTS[priority] || SLA_DEFAULTS.P4;
  try {
    const policies = await getEffectivePolicies(organizationId || null);
    const p = policies.find((x) => x.priority === priority);
    if (!p) return fallback;
    return { response: p.responseTimeMinutes, resolution: p.resolutionTimeMinutes };
  } catch (err) {
    // Never block incident creation on a policy lookup failure
    logger.warn(`SLA policy lookup failed, using defaults: ${err.message}`);
    return fallback;
  }
}

async function calculateSLATargetTimesForOrg(priority, createdAt, organizationId) {
  const sla = await resolveSLATargets(priority, organizationId);
  const base = new Date(createdAt);
  return {
    slaTargetResponse: new Date(base.getTime() + sla.response * 60000),
    slaTargetResolution: new Date(base.getTime() + sla.resolution * 60000),
  };
}

// Create or update the policy for one priority within an org (null = platform-wide).
// findFirst + update/create because Postgres treats NULL organizationId as distinct in
// the (priority, organizationId) unique index, so Prisma upsert can't target it.
async function upsertPolicy(organizationId, priority, { responseTimeMinutes, resolutionTimeMinutes, businessHoursOnly, name }) {
  const existing = await prisma.sLADefinition.findFirst({ where: { organizationId, priority } });
  const data = {
    responseTimeMinutes,
    resolutionTimeMinutes,
    ...(businessHoursOnly !== undefined && { businessHoursOnly }),
    name: name || existing?.name || `${priority} SLA`,
    isActive: true,
  };
  const saved = existing
    ? await prisma.sLADefinition.update({ where: { id: existing.id }, data })
    : await prisma.sLADefinition.create({ data: { ...data, priority, organizationId } });
  invalidate(organizationId === null ? undefined : organizationId);
  return saved;
}

// Remove an org override so the platform/default policy applies again
async function resetPolicy(organizationId, priority) {
  const { count } = await prisma.sLADefinition.deleteMany({ where: { organizationId, priority } });
  invalidate(organizationId === null ? undefined : organizationId);
  return count;
}

module.exports = {
  getEffectivePolicies,
  resolveSLATargets,
  calculateSLATargetTimesForOrg,
  upsertPolicy,
  resetPolicy,
  invalidate,
};
