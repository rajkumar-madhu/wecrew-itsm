// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — SMS Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { paginate, paginationMeta, success, error } = require('../utils/helpers');
const { getCreateOrgId } = require('../middleware/tenant');
const smsService = require('../services/smsService');
const logger = require('../utils/logger');

// POST /api/v1/sms/send
async function sendSMS(req, res, next) {
  try {
    const { recipient, message, provider, templateId, incidentId } = req.body;

    if (!recipient || !message) {
      return error(res, 'recipient and message are required', 400);
    }

    const result = await smsService.sendSMS(recipient, message, {
      preferredProvider: provider,
      templateId,
      incidentId,
    });

    return success(res, result, 201);
  } catch (err) { next(err); }
}

// POST /api/v1/sms/bulk
async function sendBulkSMS(req, res, next) {
  try {
    const { recipients, message, provider, templateId } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0 || !message) {
      return error(res, 'recipients (array) and message are required', 400);
    }

    if (recipients.length > 100) {
      return error(res, 'Maximum 100 recipients per bulk send', 400);
    }

    const results = await smsService.sendBulkSMS(recipients, message, {
      preferredProvider: provider,
      templateId,
    });

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return success(res, { sent, failed, total: recipients.length, results }, 201);
  } catch (err) { next(err); }
}

// GET /api/v1/sms/logs
async function getSMSLogs(req, res, next) {
  try {
    const { direction, provider, status, incidentId } = req.query;
    const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);

    const tw = req.tenantWhere || {};
    const where = { ...tw };
    if (direction) where.direction = direction;
    if (provider) where.provider = provider;
    if (status) where.status = status;
    if (incidentId) where.incidentId = incidentId;

    const [logs, total] = await prisma.$transaction([
      prisma.sMSLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { incident: { select: { id: true, number: true, shortDescription: true } } },
      }),
      prisma.sMSLog.count({ where }),
    ]);

    return success(res, logs, 200, paginationMeta(total, page, limit));
  } catch (err) { next(err); }
}

// GET /api/v1/sms/logs/:id
async function getSMSLog(req, res, next) {
  try {
    const log = await prisma.sMSLog.findUnique({
      where: { id: req.params.id },
      include: { incident: { select: { id: true, number: true, shortDescription: true } } },
    });
    if (!log) return error(res, 'SMS log not found', 404);
    // Tenant access check
    const tw = req.tenantWhere || {};
    if (tw.organizationId && log.organizationId !== tw.organizationId) {
      return error(res, 'SMS log not found', 404);
    }
    return success(res, log);
  } catch (err) { next(err); }
}

// GET /api/v1/sms/stats
async function getSMSStats(req, res, next) {
  try {
    const tw = req.tenantWhere || {};
    const [total, sent, failed, inbound] = await prisma.$transaction([
      prisma.sMSLog.count({ where: { ...tw } }),
      prisma.sMSLog.count({ where: { ...tw, status: 'SENT' } }),
      prisma.sMSLog.count({ where: { ...tw, status: 'FAILED' } }),
      prisma.sMSLog.count({ where: { ...tw, direction: 'INBOUND' } }),
    ]);

    // Provider breakdown
    const byProvider = await prisma.sMSLog.groupBy({
      by: ['provider'],
      where: { ...tw },
      _count: { id: true },
    });

    return success(res, {
      total,
      sent,
      failed,
      inbound,
      successRate: total > 0 ? ((sent / total) * 100).toFixed(1) : 0,
      byProvider: byProvider.map(p => ({ provider: p.provider, count: p._count.id })),
    });
  } catch (err) { next(err); }
}

// GET /api/v1/sms/delivery-status/:messageId
async function checkDeliveryStatus(req, res, next) {
  try {
    const { messageId } = req.params;
    const { provider } = req.query;

    const result = await smsService.checkDeliveryStatus(messageId, provider || 'TWILIO');
    return success(res, result);
  } catch (err) { next(err); }
}

// GET /api/v1/sms/providers
async function getProviderStatus(req, res, next) {
  try {
    const [twilio, msg91, kaleyra] = await Promise.all([
      smsService.healthCheck('TWILIO'),
      smsService.healthCheck('MSG91'),
      smsService.healthCheck('KALEYRA'),
    ]);

    return success(res, {
      providers: [
        { name: 'TWILIO', ...twilio },
        { name: 'MSG91', ...msg91 },
        { name: 'KALEYRA', ...kaleyra },
      ],
    });
  } catch (err) { next(err); }
}

// POST /api/v1/webhooks/twilio/sms (inbound SMS)
async function twilioInboundSMS(req, res, next) {
  try {
    const { From, Body, MessageSid } = req.body;

    const result = await smsService.handleInboundSMS({
      from: From,
      body: Body,
      provider: 'TWILIO',
      messageId: MessageSid,
    });

    // If this triggers an incident creation, do it
    if (result.action === 'CREATE_INCIDENT') {
      const nextNumber = await prisma.incident.count() + 1;
      const incident = await prisma.incident.create({
        data: {
          number: `INC${String(nextNumber).padStart(7, '0')}`,
          shortDescription: result.description.substring(0, 200),
          description: `Auto-created from SMS by ${result.from}: ${result.description}`,
          source: 'VOICE',
          createdById: (await prisma.user.findFirst({ where: { role: 'ADMIN' } }))?.id,
        },
      });
      logger.info(`Incident ${incident.number} auto-created from inbound SMS`);
    }

    // Respond with TwiML (empty response)
    res.set('Content-Type', 'text/xml');
    return res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (err) { next(err); }
}

// POST /api/v1/webhooks/msg91/delivery
async function msg91DeliveryCallback(req, res, next) {
  try {
    const { request_id, status, number } = req.body;

    if (request_id) {
      await prisma.sMSLog.updateMany({
        where: { messageId: request_id },
        data: { status: status === 'delivered' ? 'DELIVERED' : status?.toUpperCase() },
      });
      logger.info(`MSG91 delivery callback: ${request_id} → ${status}`);
    }

    return success(res, { received: true });
  } catch (err) { next(err); }
}

// POST /api/v1/webhooks/kaleyra/delivery
async function kaleyraDeliveryCallback(req, res, next) {
  try {
    const { id, status, mobile } = req.body;

    if (id) {
      await prisma.sMSLog.updateMany({
        where: { messageId: id },
        data: { status: status === 'delivered' ? 'DELIVERED' : status?.toUpperCase() },
      });
      logger.info(`Kaleyra delivery callback: ${id} → ${status}`);
    }

    return success(res, { received: true });
  } catch (err) { next(err); }
}

module.exports = {
  sendSMS,
  sendBulkSMS,
  getSMSLogs,
  getSMSLog,
  getSMSStats,
  checkDeliveryStatus,
  getProviderStatus,
  twilioInboundSMS,
  msg91DeliveryCallback,
  kaleyraDeliveryCallback,
};
