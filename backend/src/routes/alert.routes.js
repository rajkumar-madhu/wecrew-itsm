// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Alert Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const { enforceWriteAccess } = require('../middleware/billing.middleware');
const { validateUUID, validatePagination } = require('../middleware/validator');
const { webhookLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/alert.controller');

// Webhook endpoint (no auth — uses signing secret)
router.post('/webhook', webhookLimiter, ctrl.receiveWebhook);

// Authenticated routes
router.use(authenticate);
router.use(enforceWriteAccess); // 402 on writes once the org's trial or subscription lapses

router.get('/', checkPermission('alerts', 'read'), validatePagination, ctrl.listAlerts);
router.get('/stats', checkPermission('alerts', 'read'), ctrl.getAlertStats);
router.get('/kb', checkPermission('alerts', 'read'), ctrl.getAlertKBEndpoint);
router.get('/:id', checkPermission('alerts', 'read'), validateUUID, ctrl.getAlert);
router.post('/:id/acknowledge', checkPermission('alerts', 'update'), validateUUID, ctrl.acknowledgeAlert);
router.post('/:id/silence', checkPermission('alerts', 'update'), validateUUID, ctrl.silenceAlert);
router.post('/:id/create-incident', checkPermission('incidents', 'create'), validateUUID, ctrl.createIncidentFromAlert);

module.exports = router;
