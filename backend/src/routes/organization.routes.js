// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Organization Routes (Multi-Tenant)
// ═══════════════════════════════════════════════════════════

const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { listOrganizations, getOrganization, createOrganization, updateOrganization } = require('../controllers/organization.controller');

router.use(authenticate);

router.get('/', authorize('ADMIN'), listOrganizations);
router.get('/:id', authorize('ADMIN'), getOrganization);
router.post('/', authorize('ADMIN'), createOrganization);
router.patch('/:id', authorize('ADMIN'), updateOrganization);

module.exports = router;
