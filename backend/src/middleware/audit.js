// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Audit Trail Middleware
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');

function auditLog(entityType) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Fire-and-forget audit write
      if (res.statusCode < 400 && req.method !== 'GET') {
        const entityId = req.params.id || body?.data?.id || '';
        prisma.auditLog.create({
          data: {
            userId: req.user?.id || null,
            action: `${req.method} ${req.route?.path || req.path}`,
            entityType,
            entityId: String(entityId),
            newData: req.method === 'DELETE' ? null : (req.body || null),
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          },
        }).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { auditLog };
