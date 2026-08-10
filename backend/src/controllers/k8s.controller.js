// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — K8s Cluster Controller
// GET /api/v1/k8s/overview
// GET /api/v1/k8s/pods?namespace=fs-linkedeye
// GET /api/v1/k8s/deployments?namespace=fs-linkedeye
// GET /api/v1/k8s/events?namespace=fs-linkedeye
// GET /api/v1/k8s/services?namespace=fs-linkedeye
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');
const k8s = require('../services/k8sService');

// Resolve the org's K8s connection details from Integration Hub + org fallback
// Returns { method: 'local'|'ssh'|'direct', serverIp, sshPort, sshUser, apiUrl, token, username, password, orgName }
async function resolveK8sTarget(req) {
  const orgId = req.tenantWhere?.organizationId || req.query.orgId || req.headers['x-organization-id'];

  // No org selected → use the local LinkedEye K8s cluster
  if (!orgId) {
    return { method: 'local', serverIp: 'local', sshPort: null, sshUser: null, orgName: 'wecrew' };
  }

  const [integration, org] = await Promise.all([
    prisma.integration.findFirst({
      where: { organizationId: orgId, type: 'KUBERNETES_CLUSTER', status: 'ACTIVE' },
      select: { config: true },
    }),
    prisma.organization.findUnique({ where: { id: orgId } }),
  ]);

  if (!org) {
    return { method: 'local', serverIp: 'local', sshPort: null, sshUser: null, orgName: 'wecrew' };
  }

  if (integration?.config) {
    try {
      const cfg = JSON.parse(integration.config);
      // Direct K8s API access (no SSH)
      if (cfg.accessMethod === 'direct' && cfg.k8sApiUrl) {
        return {
          method: 'direct',
          apiUrl: cfg.k8sApiUrl.replace(/\/+$/, ''),
          token: cfg.k8sToken || null,
          username: cfg.k8sUsername || null,
          password: cfg.k8sPassword || null,
          orgName: org.name,
        };
      }
      // SSH access (default)
      return {
        method: 'ssh',
        serverIp: cfg.serverIp || org.serverIp,
        sshPort: cfg.sshPort || 4422,
        sshUser: cfg.sshUser || 'finadmin',
        orgName: org.name,
      };
    } catch (e) { logger.warn('[resolveK8sTarget] Failed to parse integration config: %s', e.message); }
  }

  if (!org.serverIp) {
    return { method: 'local', serverIp: 'local', sshPort: null, sshUser: null, orgName: org.name + ' (Local)' };
  }
  return { method: 'ssh', serverIp: org.serverIp, sshPort: 4422, sshUser: 'finadmin', orgName: org.name };
}

// Helper: get K8s auth object from a direct target
function k8sAuth(target) {
  return { token: target.token, username: target.username, password: target.password };
}

// These routes sit behind `authenticate` + `tenantContext` only — no `authorize(...)` —
// so every role including VIEWER can reach them. `err.message` from k8sService carries
// the raw kubectl/SSH text (bastion SSH user, customer server IP, SSH key path on
// timeout, in-cluster service-account names); it belongs in the log, never in a body.
// `err.clientMessage` is the category-level replacement.
function k8sClientError(err) {
  return `K8s API error: ${err.clientMessage || 'The cluster request failed.'}`;
}

// GET /api/v1/k8s/overview
async function clusterOverview(req, res, next) {
  try {
    const target = await resolveK8sTarget(req);
    if (!target) return error(res, 'No K8s target configured for this org', 400);

    const overview = target.method === 'direct'
      ? await k8s.getClusterOverviewDirect(target.apiUrl, k8sAuth(target))
      : await k8s.getClusterOverview(target.serverIp, target.sshPort, target.sshUser);

    return success(res, { org: target.orgName, serverIp: target.serverIp || target.apiUrl, ...overview });
  } catch (err) {
    logger.error('[K8s] clusterOverview error:', err.message);
    return error(res, k8sClientError(err), 503);
  }
}

// GET /api/v1/k8s/pods?namespace=fs-linkedeye
async function listPods(req, res, next) {
  try {
    const target = await resolveK8sTarget(req);
    if (!target) return error(res, 'No K8s target configured for this org', 400);
    const namespace = req.query.namespace || 'fs-linkedeye';

    const pods = target.method === 'direct'
      ? await k8s.getNamespacePodsDirect(target.apiUrl, namespace, k8sAuth(target))
      : await k8s.getNamespacePods(target.serverIp, namespace, target.sshPort, target.sshUser);

    return success(res, { namespace, pods, total: pods.length });
  } catch (err) {
    logger.error('[K8s] listPods error:', err.message);
    return error(res, k8sClientError(err), 503);
  }
}

// GET /api/v1/k8s/deployments?namespace=fs-linkedeye
async function listDeployments(req, res, next) {
  try {
    const target = await resolveK8sTarget(req);
    if (!target) return error(res, 'No K8s target configured for this org', 400);
    const namespace = req.query.namespace || 'fs-linkedeye';

    const deployments = target.method === 'direct'
      ? await k8s.getDeploymentsDirect(target.apiUrl, namespace, k8sAuth(target))
      : await k8s.getDeployments(target.serverIp, namespace, target.sshPort, target.sshUser);

    const healthy = deployments.filter(d => d.healthy).length;
    return success(res, { namespace, deployments, total: deployments.length, healthy, unhealthy: deployments.length - healthy });
  } catch (err) {
    logger.error('[K8s] listDeployments error:', err.message);
    return error(res, k8sClientError(err), 503);
  }
}

// GET /api/v1/k8s/events?namespace=fs-linkedeye
async function listEvents(req, res, next) {
  try {
    const target = await resolveK8sTarget(req);
    if (!target) return error(res, 'No K8s target configured for this org', 400);
    const namespace = req.query.namespace || 'fs-linkedeye';

    const events = target.method === 'direct'
      ? await k8s.getWarningEventsDirect(target.apiUrl, namespace, k8sAuth(target))
      : await k8s.getWarningEvents(target.serverIp, namespace, target.sshPort, target.sshUser);

    return success(res, { namespace, events, total: events.length });
  } catch (err) {
    logger.error('[K8s] listEvents error:', err.message);
    return error(res, k8sClientError(err), 503);
  }
}

// GET /api/v1/k8s/services?namespace=fs-linkedeye
async function listServices(req, res, next) {
  try {
    const target = await resolveK8sTarget(req);
    if (!target) return error(res, 'No K8s target configured for this org', 400);
    const namespace = req.query.namespace || 'fs-linkedeye';

    const services = target.method === 'direct'
      ? await k8s.getServicesDirect(target.apiUrl, namespace, k8sAuth(target))
      : await k8s.getServices(target.serverIp, namespace, target.sshPort, target.sshUser);

    return success(res, { namespace, services, total: services.length });
  } catch (err) {
    logger.error('[K8s] listServices error:', err.message);
    return error(res, k8sClientError(err), 503);
  }
}

// POST /api/v1/k8s/sync-assets
// Discovers nodes from the K8s cluster and upserts them as ConfigurationItem (CMDB) records.
// Also creates a single KUBERNETES_CLUSTER asset for the cluster itself.
async function syncK8sAssets(req, res, next) {
  try {
    const target = await resolveK8sTarget(req);
    if (!target || target.method === 'local') {
      return error(res, 'Select an organization with a configured K8s cluster', 400);
    }

    const orgId = req.tenantWhere?.organizationId || req.query.orgId || req.headers['x-organization-id'];
    if (!orgId) return error(res, 'Organization context required', 400);

    // Fetch org details for environment
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return error(res, 'Organization not found', 404);

    // Fetch live cluster data (SSH or direct API)
    const overview = target.method === 'direct'
      ? await k8s.getClusterOverviewDirect(target.apiUrl, k8sAuth(target))
      : await k8s.getClusterOverview(target.serverIp, target.sshPort, target.sshUser);

    // Never persist a partial overview. A failed `get nodes` yields nodeCount 0 and
    // nodesReady 0, and the cluster status below reads `0 === 0` as LIVE — so a
    // sync run during a nodes-RBAC outage would overwrite the cluster CI with
    // "0 node(s)", status LIVE, and upsert no node CIs, silently stranding the
    // previously discovered ones while the CMDB asserts everything is healthy.
    const coreDegraded = (overview.degraded || []).filter((d) => d !== 'metrics');
    if (coreDegraded.length) {
      return error(
        res,
        `Cluster data is incomplete (${coreDegraded.join(', ')} unavailable) — not syncing. ${(overview.warnings || []).join(' ')}`.trim(),
        503
      );
    }

    const nodes = overview.nodes || [];

    let created = 0, updated = 0;

    // 1. Upsert the cluster-level asset
    const clusterName = `${org.slug}-k8s-cluster`;
    const existingCluster = await prisma.configurationItem.findFirst({
      where: { organizationId: orgId, type: 'KUBERNETES_CLUSTER', hostname: clusterName },
    });

    const clusterData = {
      name: `${org.name} — Kubernetes Cluster`,
      type: 'KUBERNETES_CLUSTER',
      status: overview.nodesReady === overview.nodeCount ? 'LIVE' : 'MAINTENANCE',
      hostname: clusterName,
      ipAddress: target.serverIp,
      location: org.environment || 'PROD',
      description: `K8s cluster with ${overview.nodeCount} node(s), ${overview.pods?.total || 0} pods`,
      cpu: `${overview.nodeCount} nodes`,
      memory: `${overview.pods?.running || 0} running pods`,
      monitoringEnabled: true,
      organizationId: orgId,
    };

    if (existingCluster) {
      await prisma.configurationItem.update({ where: { id: existingCluster.id }, data: clusterData });
      updated++;
    } else {
      await prisma.configurationItem.create({ data: clusterData });
      created++;
    }

    // 2. Upsert each node as a SERVER asset
    for (const node of nodes) {
      const existing = await prisma.configurationItem.findFirst({
        where: { organizationId: orgId, type: 'SERVER', hostname: node.name },
      });

      const nodeData = {
        name: node.name,
        type: 'SERVER',
        status: node.status === 'Ready' ? 'LIVE' : 'MAINTENANCE',
        hostname: node.name,
        ipAddress: target.serverIp,
        location: org.environment || 'PROD',
        os: node.os || null,
        osVersion: node.kubeletVersion || null,
        description: `K8s ${node.roles || 'worker'} node — ${node.arch || 'amd64'}`,
        cpu: node.cpu ? `${node.cpu} (${node.cpuPct})` : null,
        memory: node.mem ? `${node.mem} (${node.memPct})` : null,
        monitoringEnabled: true,
        organizationId: orgId,
      };

      if (existing) {
        await prisma.configurationItem.update({ where: { id: existing.id }, data: nodeData });
        updated++;
      } else {
        await prisma.configurationItem.create({ data: nodeData });
        created++;
      }
    }

    logger.info('[K8s] syncK8sAssets for %s: created=%d updated=%d', org.name, created, updated);
    return success(res, { created, updated, total: created + updated, nodes: nodes.length });
  } catch (err) {
    logger.error('[K8s] syncK8sAssets error:', err.message);
    return error(res, `K8s sync error: ${err.clientMessage || 'The cluster request failed.'}`, 503);
  }
}

// GET /api/v1/k8s/pods/:pod/logs?namespace=&container=&tail=200&since=3600&previous=false
async function podLogs(req, res, next) {
  try {
    const target = await resolveK8sTarget(req);
    if (!target) return error(res, 'No K8s target configured for this org', 400);
    const { pod } = req.params;
    const namespace = req.query.namespace || 'fs-linkedeye';
    const options = {
      container: req.query.container || undefined,
      tailLines: Math.min(parseInt(req.query.tail) || 200, 1000),
      sinceSeconds: req.query.since ? parseInt(req.query.since) : undefined,
      previous: req.query.previous === 'true',
    };

    const logs = target.method === 'direct'
      ? await k8s.getPodLogsDirect(target.apiUrl, namespace, pod, options, k8sAuth(target))
      : await k8s.getPodLogs(target.serverIp, namespace, pod, options, target.sshPort, target.sshUser);

    return success(res, { pod, namespace, logs, total: logs.length });
  } catch (err) {
    logger.error('[K8s] podLogs error:', err.message);
    return error(res, `K8s logs error: ${err.clientMessage || 'The cluster request failed.'}`, 503);
  }
}

// GET /api/v1/k8s/logs?query={namespace="fs-linkedeye"}&limit=500&since=1h&direction=backward
async function lokiLogs(req, res, next) {
  try {
    const target = await resolveK8sTarget(req);
    if (!target || target.method === 'local') {
      return error(res, 'Select an organization with configured infrastructure', 400);
    }

    const lokiPort = 3100;
    const query = req.query.query || '{namespace="fs-linkedeye"}';
    const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
    const direction = req.query.direction === 'forward' ? 'forward' : 'backward';

    // Parse since=1h/6h/24h/7d into nanosecond timestamps
    const now = Date.now() * 1_000_000;
    const sinceMap = { '15m': 15*60, '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800 };
    const sinceSeconds = sinceMap[req.query.since] || 3600;
    const start = String(now - sinceSeconds * 1e9);
    const end = String(now);

    const result = await k8s.queryLokiLogs(
      target.serverIp, query, { start, end, limit, direction },
      target.sshPort, lokiPort, target.sshUser
    );

    return success(res, { query, since: req.query.since || '1h', ...result });
  } catch (err) {
    logger.error('[K8s] lokiLogs error:', err.message);
    return error(res, `Loki query error: ${err.message}`, 503);
  }
}

// GET /api/v1/k8s/logs/labels — returns available Loki label names
async function lokiLabels(req, res, next) {
  try {
    const target = await resolveK8sTarget(req);
    if (!target || target.method === 'local') {
      return error(res, 'Select an organization with configured infrastructure', 400);
    }
    const labels = await k8s.getLokiLabels(target.serverIp, target.sshPort, 3100, target.sshUser);
    return success(res, { labels });
  } catch (err) {
    logger.error('[K8s] lokiLabels error:', err.message);
    return error(res, `Loki labels error: ${err.message}`, 503);
  }
}

// GET /api/v1/k8s/logs/labels/:name/values — returns values for a Loki label
async function lokiLabelValues(req, res, next) {
  try {
    const target = await resolveK8sTarget(req);
    if (!target || target.method === 'local') {
      return error(res, 'Select an organization with configured infrastructure', 400);
    }
    const values = await k8s.getLokiLabelValues(target.serverIp, req.params.name, target.sshPort, 3100, target.sshUser);
    return success(res, { label: req.params.name, values });
  } catch (err) {
    logger.error('[K8s] lokiLabelValues error:', err.message);
    return error(res, `Loki label values error: ${err.message}`, 503);
  }
}

module.exports = { clusterOverview, listPods, listDeployments, listEvents, listServices, syncK8sAssets, podLogs, lokiLogs, lokiLabels, lokiLabelValues };
