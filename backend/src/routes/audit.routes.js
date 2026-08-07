// ═══════════════════════════════════════════════════════════
// Argus ITSM — Audit Log Routes
// ═══════════════════════════════════════════════════════════

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { listAuditLogs, getEntityTypes } = require('../controllers/audit.controller');

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'MANAGER'));

router.get('/', listAuditLogs);
router.get('/entity-types', getEntityTypes);

module.exports = router;
