// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — SMS Routes
// ═══════════════════════════════════════════════════════════

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { validatePagination, validateUUID } = require('../middleware/validator');
const ctrl = require('../controllers/sms.controller');

const router = Router();

// Authenticated routes
router.use(authenticate);

// Send SMS
router.post('/send', authorize('ADMIN', 'MANAGER', 'ENGINEER'), ctrl.sendSMS);
router.post('/bulk', authorize('ADMIN', 'MANAGER'), ctrl.sendBulkSMS);

// SMS logs & stats
router.get('/logs', validatePagination, ctrl.getSMSLogs);
router.get('/logs/:id', validateUUID, ctrl.getSMSLog);
router.get('/stats', ctrl.getSMSStats);

// Provider management
router.get('/providers', authorize('ADMIN'), ctrl.getProviderStatus);
router.get('/delivery-status/:messageId', ctrl.checkDeliveryStatus);

module.exports = router;
