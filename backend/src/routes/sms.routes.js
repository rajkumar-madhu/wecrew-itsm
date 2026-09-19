// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — SMS Routes
// ═══════════════════════════════════════════════════════════

const { Router } = require('express');
const { authenticate, authorize, requirePlatformAdmin } = require('../middleware/auth');
const { enforceWriteAccess } = require('../middleware/billing.middleware');
const { validatePagination, validateUUID } = require('../middleware/validator');
const ctrl = require('../controllers/sms.controller');

const router = Router();

// Authenticated routes
router.use(authenticate);
router.use(enforceWriteAccess); // 402 on writes once the org's trial or subscription lapses

// Send SMS
router.post('/send', authorize('ADMIN', 'MANAGER', 'ENGINEER'), ctrl.sendSMS);
router.post('/bulk', authorize('ADMIN', 'MANAGER'), ctrl.sendBulkSMS);

// SMS logs & stats
router.get('/logs', validatePagination, ctrl.getSMSLogs);
router.get('/logs/:id', validateUUID, ctrl.getSMSLog);
router.get('/stats', ctrl.getSMSStats);

// Provider management
router.get('/providers', requirePlatformAdmin, ctrl.getProviderStatus);
router.get('/delivery-status/:messageId', ctrl.checkDeliveryStatus);

module.exports = router;
