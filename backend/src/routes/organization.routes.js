// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Organization Routes (Multi-Tenant)
// ═══════════════════════════════════════════════════════════

const router = require('express').Router();
const { authenticate, requirePlatformAdmin } = require('../middleware/auth');
const { listOrganizations, getOrganization, createOrganization, updateOrganization } = require('../controllers/organization.controller');

// Organizations are platform-level: an org ADMIN must not list, read or edit other tenants.
router.use(authenticate, requirePlatformAdmin);

router.get('/', listOrganizations);
router.get('/:id', getOrganization);
router.post('/', createOrganization);
router.patch('/:id', updateOrganization);

module.exports = router;
