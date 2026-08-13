// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Dashboard Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { cacheMiddleware } = require('../config/redis');
const ctrl = require('../controllers/dashboard.controller');

router.use(authenticate);

router.get('/stats', cacheMiddleware('dashboard', 30), ctrl.getDashboardStats);
router.get('/incident-trend', cacheMiddleware('dashboard:trend', 60), ctrl.getIncidentTrend);
router.get('/sla-compliance', cacheMiddleware('dashboard:sla', 60), ctrl.getSLACompliance);

module.exports = router;
