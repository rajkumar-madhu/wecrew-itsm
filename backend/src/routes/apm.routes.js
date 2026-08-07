// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — APM Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/apm.controller');

router.use(authenticate);

// Full overview (all metrics in one call)
router.get('/overview', ctrl.getOverview);

// Individual metric endpoints
router.get('/process-status', ctrl.getProcessStatus);
router.get('/url-status', ctrl.getUrlStatus);
router.get('/infra-metrics', ctrl.getInfraMetrics);
router.get('/infrastructure', ctrl.getInfraMetrics);   // alias used by frontend
router.get('/network', ctrl.getNetworkStatus);
router.get('/k8s-health', ctrl.getK8sHealth);
router.get('/k8s', ctrl.getK8sHealth);                 // alias used by frontend
router.get('/services', ctrl.getServiceHealth);
router.get('/active-alerts', ctrl.getActiveAlerts);

// Annotations
router.post('/annotations', ctrl.addAnnotation);

module.exports = router;
