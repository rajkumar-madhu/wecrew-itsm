// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Change Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const { enforceWriteAccess } = require('../middleware/billing.middleware');
const { validateChangeCreate, validateChangeUpdate, validateUUID, validatePagination } = require('../middleware/validator');
const { auditLog } = require('../middleware/audit');
const ctrl = require('../controllers/change.controller');

router.use(authenticate);
router.use(enforceWriteAccess); // 402 on writes once the org's trial or subscription lapses

router.get('/', checkPermission('changes', 'read'), validatePagination, ctrl.listChanges);
router.get('/:id', checkPermission('changes', 'read'), validateUUID, ctrl.getChange);
router.post('/', checkPermission('changes', 'create'), validateChangeCreate, auditLog('Change'), ctrl.createChange);
router.patch('/:id', checkPermission('changes', 'update'), validateChangeUpdate, auditLog('Change'), ctrl.updateChange);

router.post('/:id/submit', checkPermission('changes', 'update'), validateUUID, ctrl.submitForApproval);
router.post('/:id/approve', authenticate, validateUUID, ctrl.approveChange);
router.post('/:id/reject', authenticate, validateUUID, ctrl.rejectChange);

module.exports = router;
