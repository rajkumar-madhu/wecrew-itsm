// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Search Routes
// ═══════════════════════════════════════════════════════════

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { globalSearch } = require('../controllers/search.controller');

const router = Router();

router.get('/', authenticate, globalSearch);

module.exports = router;
