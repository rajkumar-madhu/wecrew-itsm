// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Inbound alert webhook authentication
//
// A per-org token (?token= or `Authorization: Bearer`) identifies the org by
// itself. Without one, callers fall back to their legacy org resolution
// (?orgId / ?orgSlug / labels / IP) so existing senders keep working — but
// anyone can name any org that way, so set ALERT_WEBHOOK_REQUIRE_TOKEN=true
// once every sender carries a token (GET /api/v1/integrations/alert-webhook).
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const logger = require('../utils/logger');

function sourceIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .split(',')[0].trim().replace('::ffff:', '');
}

/** → { orgId, legacy } on success, or { error } (answer 401). */
async function authenticateAlertWebhook(req) {
  const header = req.headers.authorization || '';
  const token = req.query.token || (header.startsWith('Bearer ') ? header.slice(7) : null);
  if (token) {
    if (typeof token !== 'string') return { error: 'Invalid webhook token' };
    const org = await prisma.organization.findUnique({
      where: { alertWebhookToken: token }, select: { id: true, isActive: true },
    });
    if (!org || !org.isActive) return { error: 'Invalid webhook token' };
    return { orgId: org.id, legacy: false };
  }
  if (process.env.ALERT_WEBHOOK_REQUIRE_TOKEN === 'true') return { error: 'Webhook token required' };
  logger.warn('[Webhook] alert webhook without token from %s — legacy org resolution', sourceIp(req));
  return { orgId: null, legacy: true };
}

module.exports = { authenticateAlertWebhook };
