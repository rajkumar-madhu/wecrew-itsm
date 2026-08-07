// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — CMDB Resolver (Prometheus instance → CI)
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const logger = require('./logger');

/**
 * Resolve a Prometheus `instance` label (e.g. "10.20.1.154:9100")
 * to a ConfigurationItem UUID by matching ipAddress, hostname, or fqdn.
 * Returns the CI id or null. Never throws.
 */
async function resolveInstanceToConfigItem(instance) {
  if (!instance) return null;

  try {
    // Strip port from instance label
    const host = instance.replace(/:\d+$/, '');
    if (!host) return null;

    const ci = await prisma.configurationItem.findFirst({
      where: {
        OR: [
          { ipAddress: { equals: host, mode: 'insensitive' } },
          { hostname: { equals: host, mode: 'insensitive' } },
          { fqdn: { equals: host, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    if (ci) {
      logger.debug(`CMDB resolved "${instance}" → CI ${ci.id}`);
    }

    return ci?.id || null;
  } catch (err) {
    logger.warn(`CMDB resolve failed for "${instance}": ${err.message}`);
    return null;
  }
}

module.exports = { resolveInstanceToConfigItem };
