// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — AI Agent Routes (Infrastructure Intelligence)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate, requirePlatformAdmin } = require('../middleware/auth');
const { isPlatformAdmin } = require('../middleware/tenant');
const { cacheMiddleware } = require('../config/redis');
const ctrl = require('../controllers/aiAgent.controller');

router.use(authenticate);

// A response whose content depends on WHO asks (platform admin vs tenant),
// not just on the org, needs that in its cache key: the shared key is per
// org, so a platform admin viewing org X would otherwise cache platform-wide
// data that X's own users are then served.
const cacheByAudience = (prefix, ttl) => (req, res, next) =>
  cacheMiddleware(isPlatformAdmin(req.user) ? `${prefix}:platform` : prefix, ttl)(req, res, next);

// These read WeCrew's own cluster, database and logs — never a tenant's.
router.get('/cluster-health', requirePlatformAdmin, cacheMiddleware('ai-agent:cluster', 60), ctrl.getClusterHealth);
router.get('/server-analysis', requirePlatformAdmin, cacheMiddleware('ai-agent:server', 60), ctrl.getServerAnalysis);
router.get('/db-analysis', requirePlatformAdmin, cacheMiddleware('ai-agent:db', 60), ctrl.getDBAnalysis);
router.get('/log-analysis', requirePlatformAdmin, cacheMiddleware('ai-agent:logs', 30), ctrl.getLogAnalysis);
router.get('/incidents/:id/resolution-details', ctrl.getResolutionDetails);
router.get('/tips', cacheByAudience('ai-agent:tips', 120), ctrl.getTips);
router.get('/assets/:id/live-metrics', cacheMiddleware('ai-agent:asset', 30), ctrl.getAssetLiveMetrics);
router.get('/assets/:id/metrics-history', cacheMiddleware('ai-agent:asset-history', 60), ctrl.getAssetMetricsHistory);
router.get('/grafana-dashboards', cacheByAudience('ai-agent:grafana', 300), ctrl.getGrafanaDashboards);
router.get('/infrastructure-metrics', cacheMiddleware('ai-agent:infra', 30), ctrl.getInfrastructureMetrics);

module.exports = router;
