// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Integration Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate, authorize, checkPermission } = require('../middleware/auth');
const { validateUUID } = require('../middleware/validator');
const ctrl = require('../controllers/integration.controller');

router.use(authenticate);

router.get('/', checkPermission('integrations', 'read'), ctrl.listIntegrations);
router.get('/:id', checkPermission('integrations', 'read'), validateUUID, ctrl.getIntegration);
router.post('/', authorize('ADMIN'), ctrl.createIntegration);
router.patch('/:id', authorize('ADMIN'), validateUUID, ctrl.updateIntegration);
router.post('/:id/test', authorize('ADMIN', 'MANAGER'), validateUUID, ctrl.testConnection);

module.exports = router;
