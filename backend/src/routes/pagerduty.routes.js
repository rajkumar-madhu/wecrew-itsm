// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — PagerDuty Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/pagerduty.controller');

// Webhook endpoint — no auth (PagerDuty calls this)
router.post('/webhook', ctrl.handleWebhook);

// All other routes require auth
router.use(authenticate);

// Connection management (admin only)
router.post('/validate', authorize('ADMIN', 'MANAGER'), ctrl.validate);
router.post('/connect', authorize('ADMIN'), ctrl.connect);
router.delete('/disconnect', authorize('ADMIN'), ctrl.disconnect);

// Read-only data (all authenticated users)
router.get('/status', ctrl.getStatus);
router.get('/overview', ctrl.getOverview);
router.get('/services', ctrl.getServices);
router.get('/incidents', ctrl.getIncidents);
router.get('/oncall', ctrl.getOnCalls);
router.get('/escalation-policies', ctrl.getEscalationPolicies);
router.get('/users', ctrl.getUsers);
router.get('/stats', ctrl.getStats);

module.exports = router;
