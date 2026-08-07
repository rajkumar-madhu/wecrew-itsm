// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Prometheus Integration Service
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const { config } = require('../config/env');
const logger = require('../utils/logger');

function getBaseUrl() {
  return config.observability.prometheusUrl;
}

function client() {
  const baseURL = getBaseUrl();
  if (!baseURL) throw new Error('PROMETHEUS_URL not configured');
  return axios.create({ baseURL, timeout: 10000 });
}

// Instant query
async function query(expr, time = undefined) {
  const params = { query: expr };
  if (time) params.time = time;
  const { data } = await client().get('/api/v1/query', { params });
  return data.data;
}

// Range query
async function queryRange(expr, start, end, step = '60s') {
  const { data } = await client().get('/api/v1/query_range', {
    params: { query: expr, start, end, step },
  });
  return data.data;
}

// Get active targets
async function getTargets(state = undefined) {
  const params = state ? { state } : {};
  const { data } = await client().get('/api/v1/targets', { params });
  return data.data;
}

// Get alerting rules
async function getAlertRules() {
  const { data } = await client().get('/api/v1/rules', { params: { type: 'alert' } });
  return data.data;
}

// Get current firing alerts
async function getFiringAlerts() {
  const { data } = await client().get('/api/v1/alerts');
  return data.data;
}

// Get runtime info
async function getRuntimeInfo() {
  const { data } = await client().get('/api/v1/status/runtimeinfo');
  return data.data;
}

// Get TSDB stats
async function getTSDBStats() {
  const { data } = await client().get('/api/v1/status/tsdb');
  return data.data;
}

// Get specific metric metadata
async function getMetricMetadata(metric) {
  const { data } = await client().get('/api/v1/metadata', { params: { metric } });
  return data.data;
}

// Health check
async function healthCheck() {
  try {
    const baseURL = getBaseUrl();
    if (!baseURL) return { healthy: false, message: 'URL not configured' };
    const resp = await axios.get(`${baseURL}/-/healthy`, { timeout: 5000 });
    return { healthy: resp.status === 200, message: 'Prometheus is healthy' };
  } catch (err) {
    return { healthy: false, message: err.message };
  }
}

// Query node_exporter metrics for a host
async function getHostMetrics(instance, duration = '1h') {
  const end = Math.floor(Date.now() / 1000);
  const start = end - parseDuration(duration);

  const [cpu, memory, disk, networkIn, networkOut] = await Promise.all([
    queryRange(`100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle",instance="${instance}"}[5m])) * 100)`, start, end, '60s'),
    queryRange(`(1 - (node_memory_MemAvailable_bytes{instance="${instance}"} / node_memory_MemTotal_bytes{instance="${instance}"})) * 100`, start, end, '60s'),
    queryRange(`(1 - (node_filesystem_avail_bytes{instance="${instance}",mountpoint="/"} / node_filesystem_size_bytes{instance="${instance}",mountpoint="/"})) * 100`, start, end, '300s'),
    queryRange(`rate(node_network_receive_bytes_total{instance="${instance}",device!="lo"}[5m])`, start, end, '60s'),
    queryRange(`rate(node_network_transmit_bytes_total{instance="${instance}",device!="lo"}[5m])`, start, end, '60s'),
  ]);

  return { cpu, memory, disk, networkIn, networkOut };
}

function parseDuration(d) {
  const match = d.match(/^(\d+)(m|h|d)$/);
  if (!match) return 3600;
  const val = parseInt(match[1], 10);
  switch (match[2]) {
    case 'm': return val * 60;
    case 'h': return val * 3600;
    case 'd': return val * 86400;
    default: return 3600;
  }
}

module.exports = {
  query, queryRange, getTargets, getAlertRules, getFiringAlerts,
  getRuntimeInfo, getTSDBStats, getMetricMetadata, healthCheck, getHostMetrics,
};
