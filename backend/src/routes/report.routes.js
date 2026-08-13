// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Report Routes
// ═══════════════════════════════════════════════════════════

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { incidentReport, changeReport, teamPerformanceReport, executiveSummary, incidentTrend } = require('../controllers/report.controller');

const router = Router();

router.use(authenticate);

router.get('/incidents', incidentReport);
router.get('/incident-trend', incidentTrend);
router.get('/changes', changeReport);
router.get('/team-performance', authorize('ADMIN', 'MANAGER'), teamPerformanceReport);
router.get('/executive-summary', executiveSummary);

module.exports = router;
