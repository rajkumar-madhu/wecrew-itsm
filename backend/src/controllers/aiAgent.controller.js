// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — AI Agent Controller (Claude + OpenAI Fallback)
// ═══════════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { prisma } = require('../config/database');
const { config } = require('../config/env');
const { success, error } = require('../utils/helpers');
const prometheusService = require('../services/prometheusService');
const lokiService = require('../services/lokiService');
const logger = require('../utils/logger');

const AGENT_SYSTEM_PROMPT = `You are LinkedEye AI Agent, an infrastructure intelligence system for the LinkedEye ITSM platform. You analyze real-time metrics from Kubernetes clusters, PostgreSQL databases, application logs, and monitoring systems. Always return structured JSON as specified. Be precise, actionable, and concise. Prioritize issues by severity.`;

async function askAI(prompt, fallback = {}) {
  try {
    let text;

    // Try Claude first
    if (config.ai.anthropicApiKey) {
      try {
        const anthropic = new Anthropic({ apiKey: config.ai.anthropicApiKey });
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: AGENT_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        });
        text = response.content[0].text.trim();
      } catch (err) {
        logger.warn('[AI Agent] Claude call failed, trying OpenAI: %s', err.message);
      }
    }

    // Fallback to OpenAI
    if (!text && config.ai.openaiApiKey) {
      const openai = new OpenAI({ apiKey: config.ai.openaiApiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 2048,
        temperature: 0.3,
        messages: [
          { role: 'system', content: AGENT_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      });
      text = response.choices[0].message.content.trim();
    }

    if (!text) {
      logger.warn('[AI Agent] No AI provider configured');
      return fallback;
    }

    // Strip markdown fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
    return JSON.parse(cleaned);
  } catch (err) {
    logger.warn('[AI Agent] AI call failed: %s', err.message);
    return fallback;
  }
}

// ── Build auth headers for direct Prometheus access ──────────────────
// Supports Bearer token (apiKey) or HTTP Basic Auth (username + password)
function buildPromAuthHeaders(access) {
  if (access.apiKey) return { Authorization: `Bearer ${access.apiKey}` };
  if (access.username && access.password) {
    const b64 = Buffer.from(`${access.username}:${access.password}`).toString('base64');
    return { Authorization: `Basic ${b64}` };
  }
  return {};
}

// ── Resolve Prometheus access method for an asset's org ──────────────
// Returns { method: 'local'|'ssh'|'direct', serverIp, sshPort, promPort, promUrl, apiKey, username, password }
async function resolvePrometheusAccess(organizationId) {
  if (!organizationId) return { method: 'local' };

  // Check Integration Hub for PROMETHEUS integration config
  const [integration, org] = await Promise.all([
    prisma.integration.findFirst({
      where: { organizationId, type: 'PROMETHEUS', status: 'ACTIVE' },
      select: { config: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { serverIp: true },
    }),
  ]);

  // Parse integration config if available
  if (integration?.config) {
    try {
      const cfg = JSON.parse(integration.config);
      if (cfg.accessMethod === 'direct' && cfg.prometheusUrl) {
        return {
          method: 'direct',
          promUrl: cfg.prometheusUrl.replace(/\/+$/, ''),
          apiKey: cfg.apiKey || null,
          username: cfg.prometheusUsername || null,
          password: cfg.prometheusPassword || null,
        };
      }
      if (cfg.accessMethod === 'ssh' || cfg.sshPort) {
        return {
          method: 'ssh',
          serverIp: cfg.serverIp || org?.serverIp || null,
          sshPort: cfg.sshPort || 4422,
          sshUser: cfg.sshUser || 'finadmin',
          promPort: cfg.promPort || 30000,
        };
      }
    } catch (_) { /* invalid JSON — fall through */ }
  }

  // Fallback: if org has serverIp, use SSH (backwards-compatible)
  if (org?.serverIp) {
    return { method: 'ssh', serverIp: org.serverIp, sshPort: 4422, sshUser: 'finadmin', promPort: 30000 };
  }

  return { method: 'local' };
}

// ── Execute Prometheus queries based on access method ────────────────
async function executePromQueries(access, queryMap) {
  if (access.method === 'ssh' && access.serverIp) {
    const k8sService = require('../services/k8sService');
    return k8sService.batchRemotePromQueries(access.serverIp, queryMap, access.sshPort, access.promPort, access.sshUser);
  }
  if (access.method === 'direct' && access.promUrl) {
    // Direct HTTP queries to remote Prometheus (Bearer token or Basic Auth)
    const axios = require('axios');
    const headers = buildPromAuthHeaders(access);
    const results = {};
    const entries = Object.entries(queryMap);
    // Batch in groups of 6 to avoid overwhelming the remote
    for (let i = 0; i < entries.length; i += 6) {
      const batch = entries.slice(i, i + 6);
      const promises = batch.map(async ([label, query]) => {
        try {
          const { data } = await axios.get(`${access.promUrl}/api/v1/query`, {
            params: { query }, headers, timeout: 10000,
          });
          results[label] = data.status === 'success' ? data.data : { resultType: 'vector', result: [] };
        } catch (err) {
          logger.warn('[AI Agent] Direct Prometheus query %s failed: %s', label, err.message);
          results[label] = { resultType: 'vector', result: [] };
        }
      });
      await Promise.all(promises);
    }
    return results;
  }
  return null; // local — caller uses safeGather
}

async function executePromRangeQueries(access, queryMap, start, end, step) {
  if (access.method === 'ssh' && access.serverIp) {
    const k8sService = require('../services/k8sService');
    return k8sService.batchRemotePromRangeQueries(access.serverIp, queryMap, start, end, step, access.sshPort, access.promPort, access.sshUser);
  }
  if (access.method === 'direct' && access.promUrl) {
    const axios = require('axios');
    const headers = buildPromAuthHeaders(access);
    const results = {};
    const entries = Object.entries(queryMap);
    for (let i = 0; i < entries.length; i += 4) {
      const batch = entries.slice(i, i + 4);
      const promises = batch.map(async ([label, query]) => {
        try {
          const { data } = await axios.get(`${access.promUrl}/api/v1/query_range`, {
            params: { query, start, end, step }, headers, timeout: 15000,
          });
          results[label] = data.status === 'success' ? data.data : { resultType: 'matrix', result: [] };
        } catch (err) {
          logger.warn('[AI Agent] Direct Prometheus range query %s failed: %s', label, err.message);
          results[label] = { resultType: 'matrix', result: [] };
        }
      });
      await Promise.all(promises);
    }
    return results;
  }
  return null;
}

async function fetchRemoteAlerts(access) {
  if (access.method === 'ssh' && access.serverIp) {
    const k8sService = require('../services/k8sService');
    return k8sService.getRemoteFiringAlerts(access.serverIp, access.sshPort, access.promPort, access.sshUser);
  }
  if (access.method === 'direct' && access.promUrl) {
    const axios = require('axios');
    const headers = buildPromAuthHeaders(access);
    try {
      const { data } = await axios.get(`${access.promUrl}/api/v1/alerts`, { headers, timeout: 10000 });
      if (data.status === 'success') {
        return { alerts: (data.data?.alerts || []).filter(a => a.state === 'firing') };
      }
    } catch (err) {
      logger.warn('[AI Agent] Direct Prometheus alerts fetch failed: %s', err.message);
    }
    return { alerts: [] };
  }
  return null;
}

// Helper: safely gather data from a source, return fallback on failure
async function safeGather(label, fn) {
  try {
    return { available: true, data: await fn() };
  } catch (err) {
    logger.warn('[AI Agent] %s unavailable: %s', label, err.message);
    return { available: false, error: 'Service unavailable', data: null };
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/v1/ai/cluster-health — K8s Cluster Overview
// ═══════════════════════════════════════════════════════════
async function getClusterHealth(req, res, next) {
  try {
    const [targets, alerts, nodeStatus, podPhases, cpuRequests, memRequests, namespaceCpu] = await Promise.all([
      safeGather('Prometheus targets', () => prometheusService.getTargets()),
      safeGather('Prometheus alerts', () => prometheusService.getFiringAlerts()),
      safeGather('Node status', () => prometheusService.query('kube_node_status_condition{condition="Ready",status="true"}')),
      safeGather('Pod phases', () => prometheusService.query('count by (phase) (kube_pod_status_phase == 1)')),
      safeGather('CPU requests', () => prometheusService.query('sum(kube_pod_container_resource_requests{resource="cpu"})')),
      safeGather('Memory requests', () => prometheusService.query('sum(kube_pod_container_resource_requests{resource="memory"})')),
      safeGather('Namespace CPU', () => prometheusService.query('sum by (namespace) (rate(container_cpu_usage_seconds_total{image!=""}[5m]))')),
    ]);

    // Build raw summary for GPT
    const rawSummary = {
      targets: targets.available ? { activeCount: targets.data?.activeTargets?.length || 0, droppedCount: targets.data?.droppedTargets?.length || 0 } : targets,
      firingAlerts: alerts.available ? (alerts.data?.alerts || []).map(a => ({ name: a.labels?.alertname, severity: a.labels?.severity, state: a.state })) : [],
      nodes: nodeStatus.available ? (nodeStatus.data?.result || []).map(r => ({ node: r.metric?.node, ready: r.value?.[1] === '1' })) : [],
      podPhases: podPhases.available ? (podPhases.data?.result || []).map(r => ({ phase: r.metric?.phase, count: parseInt(r.value?.[1] || '0') })) : [],
      cpuRequests: cpuRequests.available ? cpuRequests.data?.result?.[0]?.value?.[1] || '0' : 'N/A',
      memRequests: memRequests.available ? memRequests.data?.result?.[0]?.value?.[1] || '0' : 'N/A',
      namespaceCpu: namespaceCpu.available ? (namespaceCpu.data?.result || []).map(r => ({ namespace: r.metric?.namespace, cpuCores: parseFloat(r.value?.[1] || '0').toFixed(3) })) : [],
    };

    const firingCount = rawSummary.firingAlerts.length;
    const criticalAlerts = rawSummary.firingAlerts.filter(a => a.severity === 'critical').length;
    const nodesDown = rawSummary.nodes.filter(n => !n.ready).length;

    // Calculate health
    let healthStatus = 'healthy';
    let score = 100;
    if (criticalAlerts > 0 || nodesDown > 0) { healthStatus = 'critical'; score = Math.max(10, 100 - criticalAlerts * 20 - nodesDown * 30); }
    else if (firingCount > 0) { healthStatus = 'warning'; score = Math.max(40, 100 - firingCount * 10); }

    // AI analysis (Claude / OpenAI fallback)
    const aiResult = await askAI(
      `Analyze this Kubernetes cluster health data and return JSON with keys: "analysis" (string, 2-3 sentence assessment), "risks" (array of {severity: "critical"|"warning"|"info", title: string, description: string}), "recommendations" (array of {priority: "high"|"medium"|"low", title: string, action: string}).

Cluster data:
${JSON.stringify(rawSummary, null, 2)}`,
      { analysis: 'AI analysis unavailable', risks: [], recommendations: [] }
    );

    return success(res, {
      health: healthStatus,
      score,
      nodes: rawSummary.nodes,
      namespaces: rawSummary.namespaceCpu,
      podPhases: rawSummary.podPhases,
      firingAlerts: rawSummary.firingAlerts,
      targets: rawSummary.targets,
      cpuRequests: rawSummary.cpuRequests,
      memRequests: rawSummary.memRequests,
      aiAnalysis: aiResult.analysis || 'AI analysis unavailable',
      risks: aiResult.risks || [],
      recommendations: aiResult.recommendations || [],
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/v1/ai/server-analysis — Server/Node Metrics
// ═══════════════════════════════════════════════════════════
async function getServerAnalysis(req, res, next) {
  try {
    // Get targets to discover server instances
    const targetsResult = await safeGather('Prometheus targets', () => prometheusService.getTargets());
    const activeTargets = targetsResult.available
      ? (targetsResult.data?.activeTargets || []).filter(t => t.labels?.job === 'node-exporter' || t.labels?.job === 'node')
      : [];

    // If no node-exporter targets, try querying for any node metrics
    const instances = activeTargets.length > 0
      ? activeTargets.map(t => t.labels?.instance).filter(Boolean)
      : [];

    // Gather per-instance metrics
    const [loadAvg, memTotal, memAvail, fsAvail, fsSize] = await Promise.all([
      safeGather('Load average', () => prometheusService.query('node_load1')),
      safeGather('Memory total', () => prometheusService.query('node_memory_MemTotal_bytes')),
      safeGather('Memory available', () => prometheusService.query('node_memory_MemAvailable_bytes')),
      safeGather('Disk available', () => prometheusService.query('node_filesystem_avail_bytes{mountpoint="/"}')),
      safeGather('Disk total', () => prometheusService.query('node_filesystem_size_bytes{mountpoint="/"}')),
    ]);

    // Build server list from metrics
    const serverMap = {};
    const addMetric = (result, field, transform = v => v) => {
      if (!result.available) return;
      for (const r of (result.data?.result || [])) {
        const inst = r.metric?.instance || 'unknown';
        if (!serverMap[inst]) serverMap[inst] = { name: inst };
        serverMap[inst][field] = transform(r.value?.[1]);
      }
    };

    addMetric(loadAvg, 'load1', v => parseFloat(v || '0'));
    addMetric(memTotal, 'memTotalBytes', v => parseFloat(v || '0'));
    addMetric(memAvail, 'memAvailBytes', v => parseFloat(v || '0'));
    addMetric(fsAvail, 'diskAvailBytes', v => parseFloat(v || '0'));
    addMetric(fsSize, 'diskTotalBytes', v => parseFloat(v || '0'));

    const servers = Object.values(serverMap).map((s) => {
      const memUsedPct = s.memTotalBytes > 0 ? ((1 - s.memAvailBytes / s.memTotalBytes) * 100) : 0;
      const diskUsedPct = s.diskTotalBytes > 0 ? ((1 - s.diskAvailBytes / s.diskTotalBytes) * 100) : 0;
      let status = 'healthy';
      if (memUsedPct > 90 || diskUsedPct > 90 || s.load1 > 8) status = 'critical';
      else if (memUsedPct > 75 || diskUsedPct > 80 || s.load1 > 4) status = 'warning';

      return {
        name: s.name,
        memory: { totalGB: (s.memTotalBytes / 1073741824).toFixed(1), usedPct: memUsedPct.toFixed(1) },
        disk: { totalGB: (s.diskTotalBytes / 1073741824).toFixed(1), usedPct: diskUsedPct.toFixed(1) },
        load: s.load1 || 0,
        status,
      };
    });

    // AI analysis (Claude / OpenAI fallback)
    const aiResult = await askAI(
      `Analyze these server metrics and return JSON with keys: "analysis" (string, 2-3 sentences), "issues" (array of {severity: "critical"|"warning"|"info", server: string, title: string, description: string}), "tips" (array of {title: string, action: string}).

Server data:
${JSON.stringify(servers, null, 2)}`,
      { analysis: 'AI analysis unavailable', issues: [], tips: [] }
    );

    return success(res, {
      servers,
      aiAnalysis: aiResult.analysis || 'AI analysis unavailable',
      issues: aiResult.issues || [],
      tips: aiResult.tips || [],
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/v1/ai/db-analysis — PostgreSQL Health
// ═══════════════════════════════════════════════════════════
async function getDBAnalysis(req, res, next) {
  try {
    const [pool, tables, indexes, longQueries, dbSize, connStates] = await Promise.all([
      safeGather('DB connections', () => prisma.$queryRaw`
        SELECT
          numbackends AS active_connections,
          xact_commit AS transactions_committed,
          xact_rollback AS transactions_rolled_back,
          blks_read AS blocks_read,
          blks_hit AS blocks_hit,
          deadlocks
        FROM pg_stat_database
        WHERE datname = current_database()
      `.then(r => r[0] || {})),

      safeGather('Table stats', () => prisma.$queryRaw`
        SELECT
          relname AS table_name,
          n_live_tup AS row_count,
          n_dead_tup AS dead_rows,
          last_vacuum,
          last_autovacuum
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 20
      `),

      safeGather('Index stats', () => prisma.$queryRaw`
        SELECT
          relname AS table_name,
          indexrelname AS index_name,
          idx_scan AS scans,
          pg_relation_size(indexrelid) AS index_size_bytes
        FROM pg_stat_user_indexes
        ORDER BY idx_scan ASC
        LIMIT 20
      `),

      safeGather('Long queries', () => prisma.$queryRaw`
        SELECT
          pid,
          EXTRACT(EPOCH FROM (now() - query_start))::integer AS duration_seconds,
          LEFT(query, 200) AS query,
          state,
          usename
        FROM pg_stat_activity
        WHERE (now() - query_start) > interval '10 seconds'
          AND state != 'idle'
          AND pid != pg_backend_pid()
        ORDER BY query_start ASC
        LIMIT 10
      `),

      safeGather('DB size', () => prisma.$queryRaw`
        SELECT pg_database_size(current_database()) AS size_bytes
      `.then(r => Number(r[0]?.size_bytes || 0))),

      safeGather('Connection states', () => prisma.$queryRaw`
        SELECT state, count(*)::integer AS count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state
      `),
    ]);

    // Serialize BigInt values
    const serialize = (obj) => JSON.parse(JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? Number(v) : v));

    const connections = {
      active: pool.available ? Number(pool.data?.active_connections || 0) : 0,
      txCommitted: pool.available ? Number(pool.data?.transactions_committed || 0) : 0,
      txRolledBack: pool.available ? Number(pool.data?.transactions_rolled_back || 0) : 0,
      deadlocks: pool.available ? Number(pool.data?.deadlocks || 0) : 0,
      cacheHitRatio: pool.available && pool.data?.blocks_hit
        ? ((Number(pool.data.blocks_hit) / (Number(pool.data.blocks_hit) + Number(pool.data.blocks_read) || 1)) * 100).toFixed(1)
        : 'N/A',
      states: connStates.available ? serialize(connStates.data || []) : [],
    };

    const tableData = tables.available ? serialize(tables.data || []) : [];
    const indexData = indexes.available ? serialize(indexes.data || []) : [];
    const slowQueries = longQueries.available ? serialize(longQueries.data || []) : [];
    const dbSizeBytes = dbSize.available ? dbSize.data : 0;

    // Calculate health score
    const deadRowTotal = tableData.reduce((sum, t) => sum + (Number(t.dead_rows) || 0), 0);
    const unusedIndexes = indexData.filter(i => Number(i.scans) === 0).length;
    let score = 100;
    let healthStatus = 'healthy';
    if (slowQueries.length > 5) { score -= 30; healthStatus = 'critical'; }
    else if (slowQueries.length > 0) { score -= slowQueries.length * 5; }
    if (deadRowTotal > 100000) { score -= 15; healthStatus = healthStatus === 'critical' ? 'critical' : 'warning'; }
    if (unusedIndexes > 10) { score -= 10; }
    if (connections.active > 80) { score -= 20; healthStatus = 'critical'; }
    else if (connections.active > 50) { score -= 10; healthStatus = healthStatus === 'critical' ? 'critical' : 'warning'; }
    score = Math.max(0, Math.min(100, score));
    if (score < 50) healthStatus = 'critical';
    else if (score < 75) healthStatus = 'warning';

    // AI analysis (Claude / OpenAI fallback)
    const aiResult = await askAI(
      `Analyze this PostgreSQL database health data and return JSON with keys: "analysis" (string, 2-3 sentences), "issues" (array of {severity: "critical"|"warning"|"info", title: string, description: string}), "configTips" (array of {title: string, action: string, impact: string}).

Database data:
- Connections: ${JSON.stringify(connections)}
- DB Size: ${(dbSizeBytes / 1048576).toFixed(1)} MB
- Tables (top 20): ${JSON.stringify(tableData.slice(0, 10))}
- Unused indexes: ${unusedIndexes} of ${indexData.length}
- Slow queries (>10s): ${slowQueries.length}
- Dead rows total: ${deadRowTotal}`,
      { analysis: 'AI analysis unavailable', issues: [], configTips: [] }
    );

    return success(res, {
      health: healthStatus,
      score,
      connections,
      dbSizeMB: (dbSizeBytes / 1048576).toFixed(1),
      tables: tableData,
      indexes: indexData,
      slowQueries,
      aiAnalysis: aiResult.analysis || 'AI analysis unavailable',
      issues: aiResult.issues || [],
      configTips: aiResult.configTips || [],
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/v1/ai/log-analysis — Error Pattern Detection
// ═══════════════════════════════════════════════════════════
async function getLogAnalysis(req, res, next) {
  try {
    const [errorLogs, warnLogs] = await Promise.all([
      safeGather('Error logs', () => lokiService.searchLogs('error', 'fs-linkedeye', '1h', 500)),
      safeGather('Warning logs', () => lokiService.searchLogs('warn', 'fs-linkedeye', '1h', 500)),
    ]);

    // Extract log lines
    const extractLines = (result) => {
      if (!result.available || !result.data?.result) return [];
      const lines = [];
      for (const stream of result.data.result) {
        for (const [ts, line] of (stream.values || [])) {
          lines.push({ timestamp: ts, message: line.substring(0, 300) });
        }
      }
      return lines;
    };

    const errorLines = extractLines(errorLogs);
    const warnLines = extractLines(warnLogs);

    // Simple pattern detection: group by first 60 chars
    const patternMap = {};
    for (const line of errorLines) {
      const key = line.message.substring(0, 60).replace(/\d+/g, 'N').trim();
      if (!patternMap[key]) patternMap[key] = { pattern: key, count: 0, severity: 'error', sample: line.message };
      patternMap[key].count++;
    }
    for (const line of warnLines) {
      const key = line.message.substring(0, 60).replace(/\d+/g, 'N').trim();
      if (!patternMap[key]) patternMap[key] = { pattern: key, count: 0, severity: 'warning', sample: line.message };
      patternMap[key].count++;
    }
    const patterns = Object.values(patternMap).sort((a, b) => b.count - a.count).slice(0, 20);

    // AI analysis (Claude / OpenAI fallback)
    const aiResult = await askAI(
      `Analyze these application log error patterns (last 1 hour) and return JSON with keys: "analysis" (string, 2-3 sentences), "issues" (array of {severity: "critical"|"warning"|"info", title: string, description: string, suggestedFix: string}), "tips" (array of {title: string, action: string}).

Error count: ${errorLines.length}
Warning count: ${warnLines.length}
Top patterns:
${JSON.stringify(patterns.slice(0, 10), null, 2)}`,
      { analysis: 'AI analysis unavailable', issues: [], tips: [] }
    );

    return success(res, {
      errorCount: errorLines.length,
      warnCount: warnLines.length,
      patterns,
      aiAnalysis: aiResult.analysis || 'AI analysis unavailable',
      issues: aiResult.issues || [],
      tips: aiResult.tips || [],
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/v1/ai/incidents/:id/resolution-details
// ═══════════════════════════════════════════════════════════
async function getResolutionDetails(req, res, next) {
  try {
    const { id } = req.params;

    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignmentGroup: { select: { id: true, name: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
        relatedAlerts: { take: 5 },
      },
    });

    if (!incident) {
      return error(res, 'Incident not found', 404);
    }

    // Find related incidents with same category
    const relatedIncidents = await prisma.incident.findMany({
      where: {
        id: { not: id },
        category: incident.category,
        state: { in: ['RESOLVED', 'CLOSED'] },
      },
      select: { id: true, number: true, shortDescription: true, priority: true, resolvedAt: true, resolutionNotes: true },
      orderBy: { resolvedAt: 'desc' },
      take: 5,
    });

    // SLA config
    const SLA_CONFIG = {
      P1: { response: 5, resolution: 60 },
      P2: { response: 15, resolution: 240 },
      P3: { response: 60, resolution: 1440 },
      P4: { response: 240, resolution: 4320 },
    };
    const slaConfig = SLA_CONFIG[incident.priority] || SLA_CONFIG.P4;

    // AI analysis (Claude / OpenAI fallback) for resolution steps
    const aiResult = await askAI(
      `Generate a detailed resolution plan for this ITSM incident. Return JSON with keys: "resolutionSteps" (array of {step: number, title: string, description: string, estimatedMinutes: number}), "configChanges" (array of {system: string, change: string, command: string}), "verificationChecklist" (array of {item: string, command: string}), "analysis" (string, 2-3 sentence summary).

Incident:
- Number: ${incident.number}
- Title: ${incident.shortDescription}
- Description: ${(incident.description || '').substring(0, 500)}
- Priority: ${incident.priority}
- Category: ${incident.category || 'UNKNOWN'}
- Subcategory: ${incident.subcategory || 'General'}
- State: ${incident.state}
- Source: ${incident.source}
- Related resolved incidents: ${JSON.stringify(relatedIncidents.map(r => ({ number: r.number, title: r.shortDescription, resolution: (r.resolutionNotes || '').substring(0, 100) })))}`,
      { resolutionSteps: [], configChanges: [], verificationChecklist: [], analysis: 'AI analysis unavailable' }
    );

    return success(res, {
      incident: {
        id: incident.id,
        number: incident.number,
        shortDescription: incident.shortDescription,
        description: incident.description,
        priority: incident.priority,
        category: incident.category,
        subcategory: incident.subcategory,
        state: incident.state,
        source: incident.source,
        assignee: incident.assignedTo,
        team: incident.assignmentGroup,
        createdAt: incident.createdAt,
      },
      slaConfig,
      resolutionSteps: aiResult.resolutionSteps || [],
      configChanges: aiResult.configChanges || [],
      verificationChecklist: aiResult.verificationChecklist || [],
      relatedIncidents,
      aiAnalysis: aiResult.analysis || 'AI analysis unavailable',
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/v1/ai/tips — Aggregated Issues, Tips & Health Score
// ═══════════════════════════════════════════════════════════
async function getTips(req, res, next) {
  try {
    // Gather data from all sources in parallel
    const [clusterData, dbData, logData, recentP1P2, firingAlerts] = await Promise.all([
      // Cluster summary (lightweight)
      safeGather('Cluster', async () => {
        const [nodeStatus, podPhases] = await Promise.all([
          prometheusService.query('kube_node_status_condition{condition="Ready",status="true"}'),
          prometheusService.query('count by (phase) (kube_pod_status_phase == 1)'),
        ]);
        return {
          nodesReady: (nodeStatus?.result || []).length,
          podPhases: (podPhases?.result || []).map(r => ({ phase: r.metric?.phase, count: parseInt(r.value?.[1] || '0') })),
        };
      }),

      // DB summary (lightweight)
      safeGather('Database', async () => {
        const [poolResult, longQResult] = await Promise.all([
          prisma.$queryRaw`SELECT numbackends AS active_connections, deadlocks FROM pg_stat_database WHERE datname = current_database()`,
          prisma.$queryRaw`SELECT count(*)::integer AS count FROM pg_stat_activity WHERE (now() - query_start) > interval '30 seconds' AND state != 'idle' AND pid != pg_backend_pid()`,
        ]);
        return {
          activeConnections: Number(poolResult[0]?.active_connections || 0),
          deadlocks: Number(poolResult[0]?.deadlocks || 0),
          longRunningQueries: longQResult[0]?.count || 0,
        };
      }),

      // Log summary (lightweight)
      safeGather('Logs', async () => {
        const errorLogs = await lokiService.searchLogs('error', 'fs-linkedeye', '1h', 100);
        return { errorCount: (errorLogs?.result || []).reduce((sum, s) => sum + (s.values?.length || 0), 0) };
      }),

      // Recent P1/P2 incidents
      safeGather('Recent incidents', () => prisma.incident.findMany({
        where: {
          priority: { in: ['P1', 'P2'] },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true, number: true, shortDescription: true, priority: true, state: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })),

      // Firing alerts
      safeGather('Alerts', () => prometheusService.getFiringAlerts()),
    ]);

    const alertsList = firingAlerts.available ? (firingAlerts.data?.alerts || []) : [];
    const p1p2List = recentP1P2.available ? (recentP1P2.data || []) : [];

    // Build summary for GPT
    const summary = {
      cluster: clusterData.available ? clusterData.data : { status: 'unavailable' },
      database: dbData.available ? dbData.data : { status: 'unavailable' },
      logs: logData.available ? logData.data : { status: 'unavailable' },
      firingAlerts: alertsList.map(a => ({ name: a.labels?.alertname, severity: a.labels?.severity })),
      recentP1P2: p1p2List.map(i => ({ number: i.number, title: i.shortDescription, priority: i.priority, state: i.state })),
    };

    const aiResult = await askAI(
      `Analyze this aggregated infrastructure data and return JSON with keys: "overallScore" (0-100 integer), "status" ("healthy"|"warning"|"critical"), "issues" (array of max 5 items: {severity: "critical"|"warning"|"info", source: "cluster"|"database"|"logs"|"incidents"|"alerts", title: string, description: string}), "tips" (array of max 5 items: {priority: "high"|"medium"|"low", title: string, action: string, impact: string}), "correlations" (string, 1-2 sentences about cross-source patterns).

Infrastructure summary:
${JSON.stringify(summary, null, 2)}`,
      { overallScore: 75, status: 'warning', issues: [], tips: [], correlations: 'AI correlation analysis unavailable' }
    );

    return success(res, {
      overallScore: aiResult.overallScore ?? 75,
      status: aiResult.status || 'warning',
      issues: aiResult.issues || [],
      tips: aiResult.tips || [],
      correlations: aiResult.correlations || '',
      sources: {
        cluster: { available: clusterData.available },
        database: { available: dbData.available },
        logs: { available: logData.available },
        alerts: { available: firingAlerts.available, count: alertsList.length },
        incidents: { available: recentP1P2.available, p1p2Count: p1p2List.length },
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/v1/ai/assets/:id/live-metrics — Full Node Exporter Details
// ═══════════════════════════════════════════════════════════
async function getAssetLiveMetrics(req, res, next) {
  try {
    const { id } = req.params;

    // 1. Fetch asset from DB
    const asset = await prisma.configurationItem.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        supportGroup: { select: { id: true, name: true } },
        incidents: { select: { id: true, number: true, shortDescription: true, priority: true, state: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!asset) return error(res, 'Asset not found', 404);

    const ip = asset.ipAddress;
    if (!ip) return error(res, 'Asset has no IP address — cannot query Prometheus', 400);

    const instance = `${ip}:9100`;
    const DEV_FILTER = 'device!~"lo|veth.*|cali.*|flannel.*|cni.*|docker.*"';

    // 2. Resolve Prometheus access method (local / ssh / direct) via Integration Hub
    const access = await resolvePrometheusAccess(asset.organizationId);
    const isRemote = access.method !== 'local';

    // 3. Build PromQL query map (same queries for any access method)
    const PROM_QUERIES = {
      uname: `node_uname_info{instance="${instance}"}`,
      boot_time: `node_boot_time_seconds{instance="${instance}"}`,
      load1: `node_load1{instance="${instance}"}`,
      load5: `node_load5{instance="${instance}"}`,
      load15: `node_load15{instance="${instance}"}`,
      cpu_usage: `100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle",instance="${instance}"}[5m])) * 100)`,
      cpu_count: `count(node_cpu_seconds_total{mode="idle",instance="${instance}"})`,
      mem_total: `node_memory_MemTotal_bytes{instance="${instance}"}`,
      mem_avail: `node_memory_MemAvailable_bytes{instance="${instance}"}`,
      mem_buffers: `node_memory_Buffers_bytes{instance="${instance}"}`,
      mem_cached: `node_memory_Cached_bytes{instance="${instance}"}`,
      swap_total: `node_memory_SwapTotal_bytes{instance="${instance}"}`,
      swap_free: `node_memory_SwapFree_bytes{instance="${instance}"}`,
      fs_size: `node_filesystem_size_bytes{instance="${instance}",fstype!~"tmpfs|devtmpfs|overlay|squashfs"}`,
      fs_avail: `node_filesystem_avail_bytes{instance="${instance}",fstype!~"tmpfs|devtmpfs|overlay|squashfs"}`,
      fs_mount: `node_filesystem_files{instance="${instance}",fstype!~"tmpfs|devtmpfs|overlay|squashfs"}`,
      net_rx_rate: `rate(node_network_receive_bytes_total{instance="${instance}",${DEV_FILTER}}[5m])`,
      net_tx_rate: `rate(node_network_transmit_bytes_total{instance="${instance}",${DEV_FILTER}}[5m])`,
      net_rx_total: `node_network_receive_bytes_total{instance="${instance}",${DEV_FILTER}}`,
      net_tx_total: `node_network_transmit_bytes_total{instance="${instance}",${DEV_FILTER}}`,
      net_rx_errs: `node_network_receive_errs_total{instance="${instance}",${DEV_FILTER}}`,
      net_tx_errs: `node_network_transmit_errs_total{instance="${instance}",${DEV_FILTER}}`,
      net_info: `node_network_info{instance="${instance}",${DEV_FILTER}}`,
      net_speed: `node_network_speed_bytes{instance="${instance}",${DEV_FILTER}}`,
      disk_reads: `rate(node_disk_reads_completed_total{instance="${instance}"}[5m])`,
      disk_writes: `rate(node_disk_writes_completed_total{instance="${instance}"}[5m])`,
      disk_read_time: `rate(node_disk_read_time_seconds_total{instance="${instance}"}[5m])`,
      disk_write_time: `rate(node_disk_write_time_seconds_total{instance="${instance}"}[5m])`,
      disk_io_time: `rate(node_disk_io_time_seconds_total{instance="${instance}"}[5m])`,
    };

    // 4. Fetch data: remote (SSH or direct) or local Prometheus
    let remotePromData = null;
    let remoteAlertData = null;
    if (isRemote) {
      const [promData, alertData] = await Promise.all([
        executePromQueries(access, PROM_QUERIES),
        fetchRemoteAlerts(access),
      ]);
      remotePromData = promData;
      remoteAlertData = alertData;
    }

    // Conditional safeGather: returns remote data when available, else queries local
    const sg = isRemote
      ? (label) => Promise.resolve(
          remotePromData?.[label]?.result?.length >= 0
            ? { available: true, data: remotePromData[label] }
            : { available: false, data: null }
        )
      : safeGather;

    const [
      unameInfo, bootTime,
      load1, load5, load15,
      cpuUsage, cpuCount,
      memTotal, memAvail, memBuffers, memCached, swapTotal, swapFree,
      fsSize, fsAvail, fsMountInfo,
      netRxRate, netTxRate, netRxTotal, netTxTotal, netRxErrs, netTxErrs, netInfo,
      netSpeed,
      diskReadsRate, diskWritesRate, diskReadTime, diskWriteTime, diskIOTime,
      firingAlerts,
    ] = await Promise.all([
      sg('uname', () => prometheusService.query(PROM_QUERIES.uname)),
      sg('boot_time', () => prometheusService.query(PROM_QUERIES.boot_time)),
      sg('load1', () => prometheusService.query(PROM_QUERIES.load1)),
      sg('load5', () => prometheusService.query(PROM_QUERIES.load5)),
      sg('load15', () => prometheusService.query(PROM_QUERIES.load15)),
      sg('cpu_usage', () => prometheusService.query(PROM_QUERIES.cpu_usage)),
      sg('cpu_count', () => prometheusService.query(PROM_QUERIES.cpu_count)),
      sg('mem_total', () => prometheusService.query(PROM_QUERIES.mem_total)),
      sg('mem_avail', () => prometheusService.query(PROM_QUERIES.mem_avail)),
      sg('mem_buffers', () => prometheusService.query(PROM_QUERIES.mem_buffers)),
      sg('mem_cached', () => prometheusService.query(PROM_QUERIES.mem_cached)),
      sg('swap_total', () => prometheusService.query(PROM_QUERIES.swap_total)),
      sg('swap_free', () => prometheusService.query(PROM_QUERIES.swap_free)),
      sg('fs_size', () => prometheusService.query(PROM_QUERIES.fs_size)),
      sg('fs_avail', () => prometheusService.query(PROM_QUERIES.fs_avail)),
      sg('fs_mount', () => prometheusService.query(PROM_QUERIES.fs_mount)),
      sg('net_rx_rate', () => prometheusService.query(PROM_QUERIES.net_rx_rate)),
      sg('net_tx_rate', () => prometheusService.query(PROM_QUERIES.net_tx_rate)),
      sg('net_rx_total', () => prometheusService.query(PROM_QUERIES.net_rx_total)),
      sg('net_tx_total', () => prometheusService.query(PROM_QUERIES.net_tx_total)),
      sg('net_rx_errs', () => prometheusService.query(PROM_QUERIES.net_rx_errs)),
      sg('net_tx_errs', () => prometheusService.query(PROM_QUERIES.net_tx_errs)),
      sg('net_info', () => prometheusService.query(PROM_QUERIES.net_info)),
      sg('net_speed', () => prometheusService.query(PROM_QUERIES.net_speed)),
      sg('disk_reads', () => prometheusService.query(PROM_QUERIES.disk_reads)),
      sg('disk_writes', () => prometheusService.query(PROM_QUERIES.disk_writes)),
      sg('disk_read_time', () => prometheusService.query(PROM_QUERIES.disk_read_time)),
      sg('disk_write_time', () => prometheusService.query(PROM_QUERIES.disk_write_time)),
      sg('disk_io_time', () => prometheusService.query(PROM_QUERIES.disk_io_time)),
      // Alerts: remote already fetched, local needs safeGather
      isRemote
        ? Promise.resolve(remoteAlertData?.alerts?.length >= 0
            ? { available: true, data: remoteAlertData }
            : { available: false, data: null })
        : safeGather('alerts', () => prometheusService.getFiringAlerts()),
    ]);

    // ── Parse helpers ──
    const val = (g) => g.available ? parseFloat(g.data?.result?.[0]?.value?.[1] || '0') : 0;
    const metricLabel = (g, label) => g.available ? (g.data?.result?.[0]?.metric?.[label] || '') : '';
    const allResults = (g) => g.available ? (g.data?.result || []) : [];

    // ── System Info ──
    const sysInfo = {
      hostname: metricLabel(unameInfo, 'nodename'),
      os: metricLabel(unameInfo, 'sysname'),
      kernel: metricLabel(unameInfo, 'release'),
      architecture: metricLabel(unameInfo, 'machine'),
      domainname: metricLabel(unameInfo, 'domainname'),
      uptimeSeconds: bootTime.available ? Math.floor(Date.now() / 1000 - val(bootTime)) : 0,
      uptimeDays: bootTime.available ? ((Date.now() / 1000 - val(bootTime)) / 86400).toFixed(1) : '0',
    };

    // ── CPU ──
    const cpu = {
      usagePct: cpuUsage.available ? parseFloat(val(cpuUsage).toFixed(1)) : 0,
      cores: cpuCount.available ? parseInt(cpuCount.data?.result?.[0]?.value?.[1] || '0') : 0,
    };

    // ── Load ──
    const load = {
      load1: val(load1),
      load5: val(load5),
      load15: val(load15),
    };

    // ── Memory ──
    const memTotalBytes = val(memTotal);
    const memAvailBytes = val(memAvail);
    const memory = {
      totalGB: (memTotalBytes / 1073741824).toFixed(1),
      availableGB: (memAvailBytes / 1073741824).toFixed(1),
      usedGB: ((memTotalBytes - memAvailBytes) / 1073741824).toFixed(1),
      usedPct: memTotalBytes > 0 ? ((1 - memAvailBytes / memTotalBytes) * 100).toFixed(1) : '0',
      buffersGB: (val(memBuffers) / 1073741824).toFixed(2),
      cachedGB: (val(memCached) / 1073741824).toFixed(2),
      swapTotalGB: (val(swapTotal) / 1073741824).toFixed(1),
      swapUsedGB: ((val(swapTotal) - val(swapFree)) / 1073741824).toFixed(1),
      swapUsedPct: val(swapTotal) > 0 ? (((val(swapTotal) - val(swapFree)) / val(swapTotal)) * 100).toFixed(1) : '0',
    };

    // ── Filesystems ──
    const fsMap = {};
    for (const r of allResults(fsSize)) {
      const mp = r.metric?.mountpoint || '/';
      if (!fsMap[mp]) fsMap[mp] = { mountpoint: mp, device: r.metric?.device || '', fstype: r.metric?.fstype || '' };
      fsMap[mp].totalBytes = parseFloat(r.value?.[1] || '0');
    }
    for (const r of allResults(fsAvail)) {
      const mp = r.metric?.mountpoint || '/';
      if (fsMap[mp]) fsMap[mp].availBytes = parseFloat(r.value?.[1] || '0');
    }
    const filesystems = Object.values(fsMap).map(fs => ({
      mountpoint: fs.mountpoint,
      device: fs.device,
      fstype: fs.fstype,
      totalGB: (fs.totalBytes / 1073741824).toFixed(1),
      usedGB: ((fs.totalBytes - (fs.availBytes || 0)) / 1073741824).toFixed(1),
      availGB: ((fs.availBytes || 0) / 1073741824).toFixed(1),
      usedPct: fs.totalBytes > 0 ? (((fs.totalBytes - (fs.availBytes || 0)) / fs.totalBytes) * 100).toFixed(1) : '0',
    })).sort((a, b) => parseFloat(b.usedPct) - parseFloat(a.usedPct));

    // ── Disk IOPS & Latency ──
    const diskMap = {};
    const addDisk = (result, field) => {
      for (const r of allResults(result)) {
        const dev = r.metric?.device || 'unknown';
        if (/^(loop|dm-|ram)/.test(dev)) continue; // skip virtual devices
        if (!diskMap[dev]) diskMap[dev] = { device: dev };
        diskMap[dev][field] = parseFloat(r.value?.[1] || '0');
      }
    };
    addDisk(diskReadsRate, 'readsPerSec');
    addDisk(diskWritesRate, 'writesPerSec');
    addDisk(diskReadTime, 'readTimeSec');
    addDisk(diskWriteTime, 'writeTimeSec');
    addDisk(diskIOTime, 'ioTimeSec');

    const diskIO = Object.values(diskMap).map(d => {
      const iops = (d.readsPerSec || 0) + (d.writesPerSec || 0);
      const readLatency = d.readsPerSec > 0.01 ? ((d.readTimeSec / d.readsPerSec) * 1000) : 0;
      const writeLatency = d.writesPerSec > 0.01 ? ((d.writeTimeSec / d.writesPerSec) * 1000) : 0;
      const utilPct = (d.ioTimeSec || 0) * 100;
      return {
        device: d.device,
        readsPerSec: parseFloat((d.readsPerSec || 0).toFixed(1)),
        writesPerSec: parseFloat((d.writesPerSec || 0).toFixed(1)),
        iops: parseFloat(iops.toFixed(1)),
        readLatencyMs: parseFloat(readLatency.toFixed(2)),
        writeLatencyMs: parseFloat(writeLatency.toFixed(2)),
        utilizationPct: parseFloat(Math.min(100, utilPct).toFixed(1)),
        threshold: utilPct > 90 ? 'critical' : utilPct > 70 ? 'warning' : 'healthy',
      };
    }).sort((a, b) => b.iops - a.iops);

    // ── Network Interfaces ──
    const netMap = {};
    const addNet = (result, field) => {
      for (const r of allResults(result)) {
        const dev = r.metric?.device || 'unknown';
        if (!netMap[dev]) netMap[dev] = { device: dev };
        netMap[dev][field] = parseFloat(r.value?.[1] || '0');
      }
    };
    addNet(netRxRate, 'rxBytesPerSec');
    addNet(netTxRate, 'txBytesPerSec');
    addNet(netRxTotal, 'rxTotalBytes');
    addNet(netTxTotal, 'txTotalBytes');
    addNet(netRxErrs, 'rxErrors');
    addNet(netTxErrs, 'txErrors');
    // Add interface info (speed, duplex, operstate)
    for (const r of allResults(netInfo)) {
      const dev = r.metric?.device || 'unknown';
      if (!netMap[dev]) netMap[dev] = { device: dev };
      netMap[dev].operstate = r.metric?.operstate || '';
      netMap[dev].duplex = r.metric?.duplex || '';
      netMap[dev].address = r.metric?.address || '';
    }
    // Add link speed (bytes/sec → Mbps)
    for (const r of allResults(netSpeed)) {
      const dev = r.metric?.device || 'unknown';
      if (!netMap[dev]) netMap[dev] = { device: dev };
      netMap[dev].speedBytes = parseFloat(r.value?.[1] || '0');
    }

    const formatBytes = (b) => {
      if (b >= 1073741824) return `${(b / 1073741824).toFixed(2)} GB`;
      if (b >= 1048576) return `${(b / 1048576).toFixed(2)} MB`;
      if (b >= 1024) return `${(b / 1024).toFixed(2)} KB`;
      return `${b.toFixed(0)} B`;
    };
    const formatRate = (b) => `${formatBytes(b)}/s`;

    const interfaces = Object.values(netMap).map(n => {
      const speedBytes = n.speedBytes || 0;
      const speedMbps = speedBytes > 0 ? Math.round((speedBytes * 8) / 1000000) : 0;
      const totalRate = (n.rxBytesPerSec || 0) + (n.txBytesPerSec || 0);
      const utilizationPct = speedBytes > 0 ? ((totalRate / speedBytes) * 100) : 0;
      // Threshold: warning >70%, critical >90%
      const threshold = utilizationPct > 90 ? 'critical' : utilizationPct > 70 ? 'warning' : 'healthy';
      return {
        device: n.device,
        operstate: n.operstate || 'unknown',
        duplex: n.duplex || '',
        macAddress: n.address || '',
        rxRate: formatRate(n.rxBytesPerSec || 0),
        txRate: formatRate(n.txBytesPerSec || 0),
        rxTotal: formatBytes(n.rxTotalBytes || 0),
        txTotal: formatBytes(n.txTotalBytes || 0),
        rxErrors: n.rxErrors || 0,
        txErrors: n.txErrors || 0,
        rxBytesPerSec: n.rxBytesPerSec || 0,
        txBytesPerSec: n.txBytesPerSec || 0,
        speedMbps,
        utilizationPct: parseFloat(utilizationPct.toFixed(1)),
        threshold,
        isBond: /^bond\d/.test(n.device),
        isWan: /^(eth|ens|enp|eno)\d/.test(n.device),
      };
    }).sort((a, b) => (b.rxBytesPerSec + b.txBytesPerSec) - (a.rxBytesPerSec + a.txBytesPerSec));

    // ── Alerts for this instance ──
    const nodeAlerts = firingAlerts.available
      ? (firingAlerts.data?.alerts || []).filter(a => {
          const inst = a.labels?.instance || '';
          return inst === instance || inst.startsWith(ip);
        }).map(a => ({
          alertname: a.labels?.alertname || 'Unknown',
          severity: a.labels?.severity || 'warning',
          state: a.state,
          summary: a.annotations?.summary || a.annotations?.description || '',
          activeAt: a.activeAt || '',
          labels: a.labels || {},
        }))
      : [];

    // ── Health status ──
    const cpuPct = cpu.usagePct;
    const memPct = parseFloat(memory.usedPct);
    const maxDiskPct = filesystems.length > 0 ? Math.max(...filesystems.map(f => parseFloat(f.usedPct))) : 0;
    let status = 'healthy';
    if (cpuPct > 90 || memPct > 90 || maxDiskPct > 95 || load.load1 > cpu.cores * 2 || nodeAlerts.some(a => a.severity === 'critical')) status = 'critical';
    else if (cpuPct > 75 || memPct > 75 || maxDiskPct > 85 || load.load1 > cpu.cores || nodeAlerts.length > 0) status = 'warning';

    // ── GPT Analysis ──
    const aiResult = await askAI(
      `Analyze these comprehensive server metrics and return JSON with keys: "analysis" (string, 3-4 sentence health assessment), "issues" (array of {severity: "critical"|"warning"|"info", title: string, description: string}), "recommendations" (array of {priority: "high"|"medium"|"low", title: string, action: string}).

Server: ${asset.name} (${ip})
System: ${sysInfo.os} ${sysInfo.kernel} ${sysInfo.architecture}
Uptime: ${sysInfo.uptimeDays} days
CPU: ${cpu.cores} cores, ${cpu.usagePct}% usage
Load: ${load.load1} / ${load.load5} / ${load.load15}
Memory: ${memory.usedGB}/${memory.totalGB} GB (${memory.usedPct}%), Swap: ${memory.swapUsedGB}/${memory.swapTotalGB} GB
Filesystems: ${JSON.stringify(filesystems.slice(0, 5))}
Network interfaces: ${interfaces.length} (${interfaces.map(i => `${i.device}: rx=${i.rxRate} tx=${i.txRate}`).join(', ')})
Firing alerts: ${nodeAlerts.length} (${nodeAlerts.map(a => `${a.alertname}[${a.severity}]`).join(', ')})
Incidents: ${asset.incidents?.length || 0} recent`,
      { analysis: 'AI analysis unavailable', issues: [], recommendations: [] }
    );

    return success(res, {
      asset: {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        status: asset.status,
        ipAddress: asset.ipAddress,
        hostname: asset.hostname,
        category: asset.category,
        subcategory: asset.subcategory,
        description: asset.description,
        monitoringEnabled: asset.monitoringEnabled,
        prometheusJob: asset.prometheusJob,
        owner: asset.owner,
        supportGroup: asset.supportGroup,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      },
      liveStatus: status,
      systemInfo: sysInfo,
      cpu,
      load,
      memory,
      filesystems,
      diskIO,
      interfaces,
      alerts: nodeAlerts,
      incidents: asset.incidents || [],
      aiAnalysis: aiResult.analysis || 'AI analysis unavailable',
      issues: aiResult.issues || [],
      recommendations: aiResult.recommendations || [],
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/v1/ai/grafana-dashboards — Grafana Dashboard & Panel List
// ═══════════════════════════════════════════════════════════
async function getGrafanaDashboards(req, res, next) {
  try {
    // ── Determine Grafana source: org-specific integration or default local ──
    let grafanaInternalUrl = (config.monitoring?.grafanaUrl || process.env.GRAFANA_URL || '').replace(/\/+$/, '');
    let grafanaExternalUrl = (process.env.GRAFANA_EXTERNAL_URL || 'https://fs-le-dev-grafana.finspot.in').replace(/\/+$/, '');
    let authHeader = 'Basic ' + Buffer.from('admin:admin').toString('base64');
    let remoteOrgIp = null;
    let remoteGrafanaPort = null;
    let remoteApiKey = null;
    let remoteSshPort = 4422;
    let remoteSshUser = 'finadmin';

    if (req.tenantWhere?.organizationId) {
      const [grafanaIntegration, orgRow] = await Promise.all([
        prisma.integration.findFirst({
          where: { organizationId: req.tenantWhere.organizationId, type: 'GRAFANA', status: 'ACTIVE' },
          select: { config: true },
        }),
        prisma.organization.findUnique({
          where: { id: req.tenantWhere.organizationId },
          select: { serverIp: true },
        }),
      ]);
      if (grafanaIntegration?.config) {
        try {
          const cfg = JSON.parse(grafanaIntegration.config);
          remoteSshPort = cfg.sshPort || remoteSshPort;
          remoteSshUser = cfg.sshUser || remoteSshUser;
          if (cfg.grafanaExternalUrl) {
            grafanaExternalUrl = cfg.grafanaExternalUrl.replace(/\/+$/, '');
          }
          if (cfg.grafanaPort && orgRow?.serverIp) {
            // SSH-based access using grafanaPort from config
            remoteOrgIp = cfg.serverIp || orgRow.serverIp;
            remoteGrafanaPort = cfg.grafanaPort;
            remoteApiKey = cfg.apiKey || null;
          } else if (cfg.grafanaUrl) {
            // Fallback: extract port from URL
            const urlMatch = cfg.grafanaUrl.match(/:(\d+)\/?$/);
            if (orgRow?.serverIp && urlMatch) {
              remoteOrgIp = cfg.serverIp || orgRow.serverIp;
              remoteGrafanaPort = urlMatch[1];
              remoteApiKey = cfg.apiKey || null;
            } else {
              grafanaInternalUrl = cfg.grafanaUrl.replace(/\/+$/, '');
              if (cfg.apiKey) authHeader = `Bearer ${cfg.apiKey}`;
            }
          }
        } catch (_) { /* invalid JSON — fall back to default */ }
      }
    }

    // ── Remote org: proxy Grafana API through SSH ──
    if (remoteOrgIp && remoteGrafanaPort) {
      const k8sService = require('../services/k8sService');
      const searchData = await k8sService.remoteGrafanaApi(
        remoteOrgIp, remoteGrafanaPort, '/api/search?type=dash-db', remoteApiKey, remoteSshPort, remoteSshUser
      );
      if (!searchData || !Array.isArray(searchData)) {
        return success(res, { dashboards: [], grafanaUrl: grafanaExternalUrl, error: 'Could not reach remote Grafana API via SSH' });
      }

      const dashboards = [];
      for (const db of searchData) {
        const detail = await k8sService.remoteGrafanaApi(
          remoteOrgIp, remoteGrafanaPort, `/api/dashboards/uid/${db.uid}`, remoteApiKey, remoteSshPort, remoteSshUser
        );
        const panels = (detail?.dashboard?.panels || [])
          .filter(p => p.type !== 'row')
          .map(p => ({ id: p.id, title: p.title || 'Untitled', type: p.type, gridPos: p.gridPos || { x: 0, y: 0, w: 12, h: 8 } }));
        dashboards.push({ uid: db.uid, title: db.title, url: db.url, panels });
      }
      return success(res, { dashboards, grafanaUrl: grafanaExternalUrl });
    }

    // ── Local Grafana: direct HTTP fetch ──
    if (!grafanaInternalUrl) {
      return error(res, 'GRAFANA_URL is not configured', 500);
    }

    const headers = { Authorization: authHeader, 'Content-Type': 'application/json' };

    const searchResult = await safeGather('Grafana search', async () => {
      const resp = await fetch(`${grafanaInternalUrl}/api/search?type=dash-db`, { headers });
      if (!resp.ok) throw new Error(`Grafana API ${resp.status}: ${resp.statusText}`);
      return resp.json();
    });

    if (!searchResult.available) {
      return success(res, { dashboards: [], grafanaUrl: grafanaExternalUrl, error: 'Could not reach Grafana API' });
    }

    const dashboards = await Promise.all(
      (searchResult.data || []).map(async (db) => {
        const detail = await safeGather(`Grafana dashboard ${db.uid}`, async () => {
          const resp = await fetch(`${grafanaInternalUrl}/api/dashboards/uid/${db.uid}`, { headers });
          if (!resp.ok) throw new Error(`Grafana API ${resp.status}`);
          return resp.json();
        });

        const panels = detail.available
          ? (detail.data?.dashboard?.panels || [])
              .filter(p => p.type !== 'row')
              .map(p => ({
                id: p.id,
                title: p.title || 'Untitled',
                type: p.type,
                gridPos: p.gridPos || { x: 0, y: 0, w: 12, h: 8 },
              }))
          : [];

        return { uid: db.uid, title: db.title, url: db.url, panels };
      })
    );

    return success(res, { dashboards, grafanaUrl: grafanaExternalUrl });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/v1/ai/infrastructure-metrics — Full Infrastructure Metrics
// ═══════════════════════════════════════════════════════════
async function getInfrastructureMetrics(req, res, next) {
  try {
    // ── Resolve org FIRST — determines local vs. remote Prometheus ──
    const access = await resolvePrometheusAccess(req.tenantWhere?.organizationId);
    const isRemoteOrg = access.method !== 'local';

    // ── All PromQL queries (same set for local and remote) ──
    const PROM_QUERIES = {
      cpu_usage: '100 - (avg by (instance)(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
      cpu_count: 'count by (instance)(node_cpu_seconds_total{mode="idle"})',
      load1: 'node_load1',
      load5: 'node_load5',
      load15: 'node_load15',
      mem_total: 'node_memory_MemTotal_bytes',
      mem_avail: 'node_memory_MemAvailable_bytes',
      mem_buffers: 'node_memory_Buffers_bytes',
      mem_cached: 'node_memory_Cached_bytes',
      swap_total: 'node_memory_SwapTotal_bytes',
      swap_free: 'node_memory_SwapFree_bytes',
      fs_size: 'node_filesystem_size_bytes{mountpoint="/",fstype!~"tmpfs|devtmpfs|overlay"}',
      fs_avail: 'node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|devtmpfs|overlay"}',
      disk_read: 'sum by (instance)(rate(node_disk_read_bytes_total[5m]))',
      disk_write: 'sum by (instance)(rate(node_disk_written_bytes_total[5m]))',
      net_rx: 'sum by (instance)(rate(node_network_receive_bytes_total{device!~"lo|veth.*|cali.*|flannel.*|cni.*|docker.*"}[5m]))',
      net_tx: 'sum by (instance)(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|cali.*|flannel.*|cni.*|docker.*"}[5m]))',
      node_ready: 'kube_node_status_condition{condition="Ready",status="true"}',
      node_info: 'kube_node_info',
      pod_phases: 'count by (phase)(kube_pod_status_phase == 1)',
      deploy_spec: 'kube_deployment_spec_replicas',
      deploy_avail: 'kube_deployment_status_replicas_available',
      cpu_req: 'sum(kube_pod_container_resource_requests{resource="cpu"})',
      cpu_lim: 'sum(kube_pod_container_resource_limits{resource="cpu"})',
      mem_req: 'sum(kube_pod_container_resource_requests{resource="memory"})',
      mem_lim: 'sum(kube_pod_container_resource_limits{resource="memory"})',
      restarts: 'sum by (namespace, pod)(kube_pod_container_status_restarts_total) > 0',
      oom: 'kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}',
      crash: 'kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}',
      pvc_phase: 'kube_persistentvolumeclaim_status_phase',
      pv_phase: 'kube_persistentvolume_status_phase',
      pvc_req: 'kube_persistentvolumeclaim_resource_requests_storage_bytes',
      vol_cap: 'kubelet_volume_stats_capacity_bytes',
      vol_used: 'kubelet_volume_stats_used_bytes',
      node_uname: 'node_uname_info',
    };

    // ── Fetch data: remote SSH/direct or local Prometheus ──
    let remotePromData = null;
    let remoteAlertData = null;
    if (isRemoteOrg) {
      const [promData, alertData] = await Promise.all([
        executePromQueries(access, PROM_QUERIES),
        fetchRemoteAlerts(access),
      ]);
      remotePromData = promData;
      remoteAlertData = alertData;
    }

    // safeGather that returns remote data when available, else queries local Prom
    const sg = isRemoteOrg
      ? (label) => Promise.resolve(
          remotePromData?.[label]?.result?.length >= 0
            ? { available: true, data: remotePromData[label] }
            : { available: false, data: null }
        )
      : safeGather;

    const [
      // CPU
      cpuUsage, cpuCount, load1, load5, load15,
      // Memory
      memTotal, memAvail, memBuffers, memCached, swapTotal, swapFree,
      // Disk
      fsSize, fsAvail, diskReadRate, diskWriteRate,
      // Network
      netRxRate, netTxRate,
      // K8s core
      nodeStatus, nodeInfo, podPhases,
      // Deployments
      deploySpec, deployAvail,
      // Resource allocation
      cpuRequests, cpuLimits, memRequests, memLimits,
      // Container health
      containerRestarts, oomKilled, crashLoop,
      // Volumes
      pvcPhase, pvPhase, pvcStorage, volCapacity, volUsed,
      // Hostname mapping
      nodeUname,
      // Alerts
      firingAlerts,
    ] = await Promise.all([
      // CPU
      sg('cpu_usage', () => prometheusService.query(PROM_QUERIES.cpu_usage)),
      sg('cpu_count', () => prometheusService.query(PROM_QUERIES.cpu_count)),
      sg('load1', () => prometheusService.query(PROM_QUERIES.load1)),
      sg('load5', () => prometheusService.query(PROM_QUERIES.load5)),
      sg('load15', () => prometheusService.query(PROM_QUERIES.load15)),
      // Memory
      sg('mem_total', () => prometheusService.query(PROM_QUERIES.mem_total)),
      sg('mem_avail', () => prometheusService.query(PROM_QUERIES.mem_avail)),
      sg('mem_buffers', () => prometheusService.query(PROM_QUERIES.mem_buffers)),
      sg('mem_cached', () => prometheusService.query(PROM_QUERIES.mem_cached)),
      sg('swap_total', () => prometheusService.query(PROM_QUERIES.swap_total)),
      sg('swap_free', () => prometheusService.query(PROM_QUERIES.swap_free)),
      // Disk
      sg('fs_size', () => prometheusService.query(PROM_QUERIES.fs_size)),
      sg('fs_avail', () => prometheusService.query(PROM_QUERIES.fs_avail)),
      sg('disk_read', () => prometheusService.query(PROM_QUERIES.disk_read)),
      sg('disk_write', () => prometheusService.query(PROM_QUERIES.disk_write)),
      // Network
      sg('net_rx', () => prometheusService.query(PROM_QUERIES.net_rx)),
      sg('net_tx', () => prometheusService.query(PROM_QUERIES.net_tx)),
      // K8s nodes
      sg('node_ready', () => prometheusService.query(PROM_QUERIES.node_ready)),
      sg('node_info', () => prometheusService.query(PROM_QUERIES.node_info)),
      sg('pod_phases', () => prometheusService.query(PROM_QUERIES.pod_phases)),
      // Deployments
      sg('deploy_spec', () => prometheusService.query(PROM_QUERIES.deploy_spec)),
      sg('deploy_avail', () => prometheusService.query(PROM_QUERIES.deploy_avail)),
      // Resource allocation
      sg('cpu_req', () => prometheusService.query(PROM_QUERIES.cpu_req)),
      sg('cpu_lim', () => prometheusService.query(PROM_QUERIES.cpu_lim)),
      sg('mem_req', () => prometheusService.query(PROM_QUERIES.mem_req)),
      sg('mem_lim', () => prometheusService.query(PROM_QUERIES.mem_lim)),
      // Container health
      sg('restarts', () => prometheusService.query(PROM_QUERIES.restarts)),
      sg('oom', () => prometheusService.query(PROM_QUERIES.oom)),
      sg('crash', () => prometheusService.query(PROM_QUERIES.crash)),
      // Volumes
      sg('pvc_phase', () => prometheusService.query(PROM_QUERIES.pvc_phase)),
      sg('pv_phase', () => prometheusService.query(PROM_QUERIES.pv_phase)),
      sg('pvc_req', () => prometheusService.query(PROM_QUERIES.pvc_req)),
      sg('vol_cap', () => prometheusService.query(PROM_QUERIES.vol_cap)),
      sg('vol_used', () => prometheusService.query(PROM_QUERIES.vol_used)),
      // Hostname mapping (node_uname_info → instance → nodename)
      sg('node_uname', () => prometheusService.query(PROM_QUERIES.node_uname)),
      // Alerts — remote uses pre-fetched data, local uses prometheusService
      isRemoteOrg
        ? Promise.resolve({ available: true, data: remoteAlertData })
        : safeGather('alerts', () => prometheusService.getFiringAlerts()),
    ]);

    // ── Helpers ──
    const allResults = (g) => g.available ? (g.data?.result || []) : [];
    // nodeResults: for node-exporter metrics — filter by org IP when one is selected
    // Remote orgs: skip filtering — all data on their Prometheus belongs to them
    const nodeResults = (g) => {
      const rows = allResults(g);
      if (isRemoteOrg) return rows; // remote Prometheus = all data is this org's
      if (!access.serverIp) return rows;
      return rows.filter(r => {
        const inst = r.metric?.instance || '';
        return inst === access.serverIp || inst.startsWith(access.serverIp + ':');
      });
    };
    const firstNodeVal = (g) => {
      const rows = nodeResults(g);
      return rows.length > 0 ? parseFloat(rows[0]?.value?.[1] || '0') : 0;
    };
    const firstVal = (g) => g.available ? parseFloat(g.data?.result?.[0]?.value?.[1] || '0') : 0;
    const fmt = (bytes) => {
      if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
      if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
      if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${bytes.toFixed(0)} B`;
    };
    const fmtRate = (b) => `${fmt(b)}/s`;

    // ── Hostname mapping (instance IP:port → friendly hostname) ──
    const instanceToHostname = {};
    for (const r of allResults(nodeUname)) {
      const inst = r.metric?.instance || '';
      const hostname = r.metric?.nodename || '';
      if (inst && hostname) instanceToHostname[inst] = hostname;
    }
    const friendly = (inst) => instanceToHostname[inst] || inst.replace(/:9100$/, '');

    // ── CPU ──
    const cpuNodes = nodeResults(cpuUsage).map(r => ({
      instance: friendly(r.metric?.instance || 'unknown'),
      usagePct: parseFloat(parseFloat(r.value?.[1] || '0').toFixed(1)),
    }));
    const avgCpu = cpuNodes.length > 0 ? parseFloat((cpuNodes.reduce((s, n) => s + n.usagePct, 0) / cpuNodes.length).toFixed(1)) : 0;
    const totalCores = nodeResults(cpuCount).reduce((s, r) => s + parseInt(r.value?.[1] || '0'), 0);

    const cpu = {
      avgUsagePct: avgCpu,
      totalCores,
      perNode: cpuNodes,
      load: { load1: firstNodeVal(load1), load5: firstNodeVal(load5), load15: firstNodeVal(load15) },
    };

    // ── Memory ──
    const memTotalBytes = nodeResults(memTotal).reduce((s, r) => s + parseFloat(r.value?.[1] || '0'), 0);
    const memAvailBytes = nodeResults(memAvail).reduce((s, r) => s + parseFloat(r.value?.[1] || '0'), 0);
    const memUsedBytes = memTotalBytes - memAvailBytes;
    const memory = {
      totalGB: (memTotalBytes / 1073741824).toFixed(1),
      usedGB: (memUsedBytes / 1073741824).toFixed(1),
      availableGB: (memAvailBytes / 1073741824).toFixed(1),
      usedPct: memTotalBytes > 0 ? parseFloat(((memUsedBytes / memTotalBytes) * 100).toFixed(1)) : 0,
      buffersGB: (nodeResults(memBuffers).reduce((s, r) => s + parseFloat(r.value?.[1] || '0'), 0) / 1073741824).toFixed(2),
      cachedGB: (nodeResults(memCached).reduce((s, r) => s + parseFloat(r.value?.[1] || '0'), 0) / 1073741824).toFixed(2),
      swapTotalGB: (nodeResults(swapTotal).reduce((s, r) => s + parseFloat(r.value?.[1] || '0'), 0) / 1073741824).toFixed(1),
      swapFreeGB: (nodeResults(swapFree).reduce((s, r) => s + parseFloat(r.value?.[1] || '0'), 0) / 1073741824).toFixed(1),
    };

    // ── Disk ──
    const diskNodes = {};
    for (const r of nodeResults(fsSize)) {
      const inst = r.metric?.instance || 'unknown';
      const name = friendly(inst);
      if (!diskNodes[inst]) diskNodes[inst] = { instance: name };
      diskNodes[inst].totalBytes = parseFloat(r.value?.[1] || '0');
    }
    for (const r of nodeResults(fsAvail)) {
      const inst = r.metric?.instance || 'unknown';
      if (diskNodes[inst]) diskNodes[inst].availBytes = parseFloat(r.value?.[1] || '0');
    }
    for (const r of nodeResults(diskReadRate)) {
      const inst = r.metric?.instance || 'unknown';
      if (diskNodes[inst]) diskNodes[inst].readRate = parseFloat(r.value?.[1] || '0');
    }
    for (const r of nodeResults(diskWriteRate)) {
      const inst = r.metric?.instance || 'unknown';
      if (diskNodes[inst]) diskNodes[inst].writeRate = parseFloat(r.value?.[1] || '0');
    }
    const diskList = Object.values(diskNodes).map((d) => {
      const used = (d.totalBytes || 0) - (d.availBytes || 0);
      return {
        instance: d.instance,
        total: fmt(d.totalBytes || 0),
        used: fmt(used),
        available: fmt(d.availBytes || 0),
        usedPct: d.totalBytes > 0 ? parseFloat(((used / d.totalBytes) * 100).toFixed(1)) : 0,
        readRate: fmtRate(d.readRate || 0),
        writeRate: fmtRate(d.writeRate || 0),
      };
    });
    const avgDiskPct = diskList.length > 0 ? parseFloat((diskList.reduce((s, d) => s + d.usedPct, 0) / diskList.length).toFixed(1)) : 0;
    const disk = { avgUsedPct: avgDiskPct, perNode: diskList };

    // ── Network ──
    const netNodes = {};
    for (const r of nodeResults(netRxRate)) {
      const inst = r.metric?.instance || 'unknown';
      netNodes[inst] = { ...netNodes[inst], instance: friendly(inst), rxRate: parseFloat(r.value?.[1] || '0') };
    }
    for (const r of nodeResults(netTxRate)) {
      const inst = r.metric?.instance || 'unknown';
      netNodes[inst] = { ...netNodes[inst], instance: friendly(inst), txRate: parseFloat(r.value?.[1] || '0') };
    }
    const netList = Object.values(netNodes).map(n => ({
      instance: n.instance,
      rxRate: fmtRate(n.rxRate || 0),
      txRate: fmtRate(n.txRate || 0),
      rxBytesPerSec: n.rxRate || 0,
      txBytesPerSec: n.txRate || 0,
    }));
    const network = { perNode: netList, totalRx: fmtRate(netList.reduce((s, n) => s + n.rxBytesPerSec, 0)), totalTx: fmtRate(netList.reduce((s, n) => s + n.txBytesPerSec, 0)) };

    // ── Virtualization / K8s ──
    const nodes = allResults(nodeInfo).map(r => {
      const name = r.metric?.node || r.metric?.instance || 'unknown';
      const ready = allResults(nodeStatus).some(n => (n.metric?.node || '') === name && n.value?.[1] === '1');
      return {
        name,
        kubeletVersion: r.metric?.kubelet_version || '',
        containerRuntime: r.metric?.container_runtime_version || '',
        osImage: r.metric?.os_image || '',
        kernel: r.metric?.kernel_version || '',
        ready,
      };
    });

    const podCounts = {};
    for (const r of allResults(podPhases)) {
      podCounts[r.metric?.phase || 'Unknown'] = parseInt(r.value?.[1] || '0');
    }
    const totalPods = Object.values(podCounts).reduce((s, c) => s + c, 0);

    const deployments = [];
    const deploySpecMap = {};
    for (const r of allResults(deploySpec)) {
      const ns = r.metric?.namespace || '';
      const name = r.metric?.deployment || '';
      const key = `${ns}/${name}`;
      deploySpecMap[key] = { namespace: ns, name, desired: parseInt(r.value?.[1] || '0') };
    }
    for (const r of allResults(deployAvail)) {
      const ns = r.metric?.namespace || '';
      const name = r.metric?.deployment || '';
      const key = `${ns}/${name}`;
      if (deploySpecMap[key]) {
        deploySpecMap[key].available = parseInt(r.value?.[1] || '0');
      }
    }
    for (const d of Object.values(deploySpecMap)) {
      d.available = d.available || 0;
      d.status = d.available >= d.desired ? 'healthy' : d.available > 0 ? 'degraded' : 'down';
      deployments.push(d);
    }

    const resourceAllocation = {
      cpuRequests: firstVal(cpuRequests).toFixed(2),
      cpuLimits: firstVal(cpuLimits).toFixed(2),
      memRequestsGB: (firstVal(memRequests) / 1073741824).toFixed(1),
      memLimitsGB: (firstVal(memLimits) / 1073741824).toFixed(1),
    };

    const virtualization = { nodes, podCounts, totalPods, deployments, resourceAllocation };

    // ── Container Health (Snapshots/Status) ──
    const restartPods = allResults(containerRestarts).map(r => ({
      namespace: r.metric?.namespace || '',
      pod: r.metric?.pod || '',
      restarts: parseInt(r.value?.[1] || '0'),
    })).sort((a, b) => b.restarts - a.restarts).slice(0, 15);

    const oomPods = allResults(oomKilled).map(r => ({
      namespace: r.metric?.namespace || '',
      pod: r.metric?.pod || '',
      container: r.metric?.container || '',
    }));

    const crashPods = allResults(crashLoop).map(r => ({
      namespace: r.metric?.namespace || '',
      pod: r.metric?.pod || '',
      container: r.metric?.container || '',
    }));

    const containerHealth = { restartPods, oomKilled: oomPods, crashLoopBackOff: crashPods };

    // ── Volumes / Storage ──
    const pvcMap = {};
    for (const r of allResults(pvcPhase)) {
      const ns = r.metric?.namespace || '';
      const name = r.metric?.persistentvolumeclaim || '';
      const phase = r.metric?.phase || '';
      const key = `${ns}/${name}`;
      if (r.value?.[1] === '1') {
        pvcMap[key] = { ...pvcMap[key], namespace: ns, name, phase };
      }
    }
    for (const r of allResults(pvcStorage)) {
      const ns = r.metric?.namespace || '';
      const name = r.metric?.persistentvolumeclaim || '';
      const key = `${ns}/${name}`;
      if (pvcMap[key]) pvcMap[key].requestedBytes = parseFloat(r.value?.[1] || '0');
    }
    const pvcs = Object.values(pvcMap).map(p => ({
      ...p,
      requested: fmt(p.requestedBytes || 0),
    }));

    const pvCounts = {};
    for (const r of allResults(pvPhase)) {
      const phase = r.metric?.phase || 'Unknown';
      if (r.value?.[1] === '1') pvCounts[phase] = (pvCounts[phase] || 0) + 1;
    }

    const volumeUsage = [];
    const volCapMap = {};
    for (const r of allResults(volCapacity)) {
      const ns = r.metric?.namespace || '';
      const pvc = r.metric?.persistentvolumeclaim || '';
      const key = `${ns}/${pvc}`;
      volCapMap[key] = { namespace: ns, pvc, capacityBytes: parseFloat(r.value?.[1] || '0') };
    }
    for (const r of allResults(volUsed)) {
      const ns = r.metric?.namespace || '';
      const pvc = r.metric?.persistentvolumeclaim || '';
      const key = `${ns}/${pvc}`;
      if (volCapMap[key]) {
        volCapMap[key].usedBytes = parseFloat(r.value?.[1] || '0');
      }
    }
    for (const v of Object.values(volCapMap)) {
      v.usedPct = v.capacityBytes > 0 ? parseFloat(((v.usedBytes / v.capacityBytes) * 100).toFixed(1)) : 0;
      v.capacity = fmt(v.capacityBytes);
      v.used = fmt(v.usedBytes || 0);
      volumeUsage.push(v);
    }

    const storage = { pvcs, pvCounts, volumeUsage: volumeUsage.sort((a, b) => b.usedPct - a.usedPct) };

    // ── Alerts — remote orgs already have their own alerts, local orgs filter by IP ──
    let rawAlerts = firingAlerts.available ? (firingAlerts.data?.alerts || []) : [];

    if (req.tenantWhere?.organizationId && !isRemoteOrg) {
      if (access.serverIp) {
        rawAlerts = rawAlerts.filter(a => {
          const inst = a.labels?.instance || '';
          return inst === access.serverIp || inst.startsWith(access.serverIp + ':');
        });
      } else {
        rawAlerts = []; // org has no serverIp registered — show nothing
      }
    }

    const alerts = rawAlerts.map(a => ({
      name: a.labels?.alertname || 'Unknown',
      severity: a.labels?.severity || 'warning',
      namespace: a.labels?.namespace || '',
      instance: friendly(a.labels?.instance || ''),
      summary: a.annotations?.summary || a.annotations?.description || '',
    }));

    const noDataForOrg = !!req.tenantWhere?.organizationId && access.method === 'local' && !access.serverIp;
    return success(res, { cpu, memory, disk, network, virtualization, containerHealth, storage, alerts, lastUpdated: new Date().toISOString(), orgServerIp: access.serverIp, noDataForOrg });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/v1/ai/assets/:id/metrics-history — Range query for trend charts
// ═══════════════════════════════════════════════════════════
async function getAssetMetricsHistory(req, res, next) {
  try {
    const { id } = req.params;
    const duration = req.query.duration || '6h';
    const step = req.query.step || '120s';

    const asset = await prisma.configurationItem.findUnique({ where: { id }, select: { ipAddress: true, name: true, organizationId: true } });
    if (!asset) return error(res, 'Asset not found', 404);
    if (!asset.ipAddress) return error(res, 'Asset has no IP address', 400);

    const instance = `${asset.ipAddress}:9100`;
    const end = Math.floor(Date.now() / 1000);
    const durationMatch = duration.match(/^(\d+)(m|h|d)$/);
    const seconds = durationMatch ? parseInt(durationMatch[1]) * ({ m: 60, h: 3600, d: 86400 }[durationMatch[2]] || 3600) : 21600;
    const start = end - seconds;

    // Resolve Prometheus access method via Integration Hub
    const access = await resolvePrometheusAccess(asset.organizationId);
    const isRemote = access.method !== 'local';

    const RANGE_QUERIES = {
      cpu: `100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle",instance="${instance}"}[5m])) * 100)`,
      memory: `(1 - (node_memory_MemAvailable_bytes{instance="${instance}"} / node_memory_MemTotal_bytes{instance="${instance}"})) * 100`,
      disk: `(1 - (node_filesystem_avail_bytes{instance="${instance}",mountpoint="/"} / node_filesystem_size_bytes{instance="${instance}",mountpoint="/"})) * 100`,
      networkIn: `sum(rate(node_network_receive_bytes_total{instance="${instance}",device!~"lo|veth.*|cali.*|flannel.*"}[5m]))`,
      networkOut: `sum(rate(node_network_transmit_bytes_total{instance="${instance}",device!~"lo|veth.*|cali.*|flannel.*"}[5m]))`,
      load: `node_load1{instance="${instance}"}`,
    };

    let remoteRangeData = null;
    if (isRemote) {
      remoteRangeData = await executePromRangeQueries(access, RANGE_QUERIES, start, end, step);
    }

    const sgRange = isRemote
      ? (label) => Promise.resolve(
          remoteRangeData?.[label]?.result?.length >= 0
            ? { available: true, data: remoteRangeData[label] }
            : { available: false, data: null }
        )
      : safeGather;

    const [cpuRange, memRange, diskRange, netInRange, netOutRange, loadRange] = await Promise.all([
      sgRange('cpu', () => prometheusService.queryRange(RANGE_QUERIES.cpu, start, end, step)),
      sgRange('memory', () => prometheusService.queryRange(RANGE_QUERIES.memory, start, end, step)),
      sgRange('disk', () => prometheusService.queryRange(RANGE_QUERIES.disk, start, end, step)),
      sgRange('networkIn', () => prometheusService.queryRange(RANGE_QUERIES.networkIn, start, end, step)),
      sgRange('networkOut', () => prometheusService.queryRange(RANGE_QUERIES.networkOut, start, end, step)),
      sgRange('load', () => prometheusService.queryRange(RANGE_QUERIES.load, start, end, step)),
    ]);

    const extractSeries = (g) => {
      if (!g.available) return [];
      const vals = g.data?.result?.[0]?.values || [];
      return vals.map(([ts, v]) => ({ t: ts * 1000, v: parseFloat(parseFloat(v).toFixed(2)) }));
    };

    return success(res, {
      asset: { id, name: asset.name, ip: asset.ipAddress },
      duration,
      series: {
        cpu: extractSeries(cpuRange),
        memory: extractSeries(memRange),
        disk: extractSeries(diskRange),
        networkIn: extractSeries(netInRange),
        networkOut: extractSeries(netOutRange),
        load: extractSeries(loadRange),
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getClusterHealth, getServerAnalysis, getDBAnalysis, getLogAnalysis, getResolutionDetails, getTips, getAssetLiveMetrics, getAssetMetricsHistory, getGrafanaDashboards, getInfrastructureMetrics, resolvePrometheusAccess, executePromQueries, executePromRangeQueries, fetchRemoteAlerts };
