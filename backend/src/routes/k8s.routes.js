const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceWriteAccess } = require('../middleware/billing.middleware');
const { tenantContext } = require('../middleware/tenant');
const ctrl = require('../controllers/k8s.controller');

router.use(authenticate, tenantContext);
router.use(enforceWriteAccess); // 402 on writes once the org's trial or subscription lapses

// Cluster overview — nodes, pod counts, namespace summary
router.get('/overview', ctrl.clusterOverview);

// Pods in a namespace
router.get('/pods', ctrl.listPods);

// Deployments in a namespace
router.get('/deployments', ctrl.listDeployments);

// Warning events in a namespace
router.get('/events', ctrl.listEvents);

// Services in a namespace
router.get('/services', ctrl.listServices);

// Pod logs
router.get('/pods/:pod/logs', ctrl.podLogs);

// Loki log queries
router.get('/logs', ctrl.lokiLogs);
router.get('/logs/labels', ctrl.lokiLabels);
router.get('/logs/labels/:name/values', ctrl.lokiLabelValues);

// Sync K8s nodes → CMDB assets (ADMIN only)
router.post('/sync-assets', authorize('ADMIN'), ctrl.syncK8sAssets);

module.exports = router;
