// ═══════════════════════════════════════════════════════════
// Argus ITSM — SLA Policy Routes
// ═══════════════════════════════════════════════════════════

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const ctrl = require('../controllers/sla.controller');

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listPolicies);
router.get('/business-hours', ctrl.getBusinessHours);
router.put('/business-hours', authorize('ADMIN', 'MANAGER'), auditLog('BusinessHours'), ctrl.updateBusinessHours);
router.put('/:priority', authorize('ADMIN', 'MANAGER'), auditLog('SLADefinition'), ctrl.updatePolicy);
router.delete('/:priority', authorize('ADMIN', 'MANAGER'), auditLog('SLADefinition'), ctrl.resetPolicy);

module.exports = router;
