// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Asset / CMDB Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const { enforceWriteAccess } = require('../middleware/billing.middleware');
const { validateUUID, validatePagination } = require('../middleware/validator');
const { auditLog } = require('../middleware/audit');
const ctrl = require('../controllers/asset.controller');

router.use(authenticate);
router.use(enforceWriteAccess); // 402 on writes once the org's trial or subscription lapses

router.get('/', checkPermission('assets', 'read'), validatePagination, ctrl.listAssets);
router.get('/stats', checkPermission('assets', 'read'), ctrl.getAssetStats);
router.get('/:id', checkPermission('assets', 'read'), validateUUID, ctrl.getAsset);
router.post('/', checkPermission('assets', 'create'), auditLog('ConfigurationItem'), ctrl.createAsset);
router.patch('/:id', checkPermission('assets', 'update'), validateUUID, auditLog('ConfigurationItem'), ctrl.updateAsset);
router.delete('/:id', checkPermission('assets', 'delete'), validateUUID, auditLog('ConfigurationItem'), ctrl.deleteAsset);

module.exports = router;
