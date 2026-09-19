// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Integration Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate, authorize, checkPermission } = require('../middleware/auth');
const { enforceWriteAccess } = require('../middleware/billing.middleware');
const { validateUUID } = require('../middleware/validator');
const ctrl = require('../controllers/integration.controller');

router.use(authenticate);
router.use(enforceWriteAccess); // 402 on writes once the org's trial or subscription lapses

router.get('/', checkPermission('integrations', 'read'), ctrl.listIntegrations);
// Static paths before /:id so 'alert-webhook' is not parsed as an id.
router.get('/alert-webhook', authorize('ADMIN'), ctrl.getAlertWebhook);
router.post('/alert-webhook/rotate', authorize('ADMIN'), ctrl.rotateAlertWebhook);
router.get('/:id', checkPermission('integrations', 'read'), validateUUID, ctrl.getIntegration);
router.post('/', authorize('ADMIN'), ctrl.createIntegration);
router.patch('/:id', authorize('ADMIN'), validateUUID, ctrl.updateIntegration);
router.post('/:id/test', authorize('ADMIN', 'MANAGER'), validateUUID, ctrl.testConnection);

module.exports = router;
