// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Incident Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const { enforceWriteAccess } = require('../middleware/billing.middleware');
const { validateIncidentCreate, validateIncidentUpdate, validateUUID, validatePagination, validateWorkNote } = require('../middleware/validator');
const { auditLog } = require('../middleware/audit');
const ctrl = require('../controllers/incident.controller');
const reportController = require('../controllers/incident-report.controller');

// ── Public one-click acknowledge (no auth — signed JWT in URL) ────────────────
// Must be defined BEFORE router.use(authenticate)
router.get('/ack', ctrl.acknowledgeFromEmail);

router.use(authenticate);
router.use(enforceWriteAccess); // 402 on writes once the org's trial or subscription lapses

// ── Report routes (specific paths must come before /:id param routes) ────────

// Bulk report — POST /api/v1/incidents/bulk-report
router.post('/bulk-report',
  checkPermission('incidents', 'read'),
  reportController.bulkReportValidation,
  reportController.generateBulkReport
);

// ── Standard CRUD ─────────────────────────────────────────────────────────────

router.get('/', checkPermission('incidents', 'read'), validatePagination, ctrl.listIncidents);
router.get('/:id', checkPermission('incidents', 'read'), validateUUID, ctrl.getIncident);
router.post('/', checkPermission('incidents', 'create'), validateIncidentCreate, auditLog('Incident'), ctrl.createIncident);
router.patch('/:id', checkPermission('incidents', 'update'), validateIncidentUpdate, auditLog('Incident'), ctrl.updateIncident);
router.delete('/:id', checkPermission('incidents', 'delete'), validateUUID, auditLog('Incident'), ctrl.deleteIncident);

router.post('/:id/notes', checkPermission('incidents', 'update'), validateUUID, validateWorkNote, ctrl.addWorkNote);
router.get('/:id/timeline', checkPermission('incidents', 'read'), validateUUID, ctrl.getTimeline);
router.get('/:id/live-context', checkPermission('incidents', 'read'), validateUUID, ctrl.getLiveContext);
router.get('/:id/escalation-logs', checkPermission('incidents', 'read'), validateUUID, ctrl.getEscalationLogs);
router.post('/:id/changes', checkPermission('incidents', 'update'), validateUUID, ctrl.linkChange);
router.post('/:id/problems', checkPermission('incidents', 'update'), validateUUID, ctrl.linkProblem);

// Single incident report — GET /api/v1/incidents/:id/report
router.get('/:id/report',
  checkPermission('incidents', 'read'),
  reportController.reportValidation,
  reportController.generateIncidentReport
);

module.exports = router;
