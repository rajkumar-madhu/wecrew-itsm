// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Agent Pipeline Routes
// AI-powered automation replacing StackStorm
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/agentPipeline.controller');

router.use(authenticate);

// Status & overview
router.get('/status', ctrl.getStatus);

// Pipeline control (admin only)
router.post('/toggle', authorize('ADMIN', 'MANAGER'), ctrl.togglePipeline);

// Remediation actions
router.get('/actions', ctrl.listActions);
router.post('/actions/:actionId/toggle', authorize('ADMIN', 'MANAGER'), ctrl.toggleAction);

// Notification rules
router.get('/notifications', ctrl.listNotifications);
router.post('/notifications/:ruleId/toggle', authorize('ADMIN', 'MANAGER'), ctrl.toggleNotification);

// Execution log
router.get('/executions', ctrl.getExecutions);
router.get('/executions/:id', ctrl.getExecution);

module.exports = router;
