// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Loki Log Query Service
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const { config } = require('../config/env');
const logger = require('../utils/logger');

function getBaseUrl() {
  return config.observability.lokiUrl;
}

function client() {
  const baseURL = getBaseUrl();
  if (!baseURL) throw new Error('LOKI_URL not configured');
  return axios.create({ baseURL, timeout: 30000 });
}

// Query logs with LogQL
async function queryLogs(logql, limit = 100, start = undefined, end = undefined) {
  const params = { query: logql, limit };
  if (start) params.start = start;
  if (end) params.end = end;
  const { data } = await client().get('/loki/api/v1/query_range', { params });
  return data.data;
}

// Instant query
async function queryInstant(logql, limit = 100, time = undefined) {
  const params = { query: logql, limit };
  if (time) params.time = time;
  const { data } = await client().get('/loki/api/v1/query', { params });
  return data.data;
}

// Get label names
async function getLabels(start = undefined, end = undefined) {
  const params = {};
  if (start) params.start = start;
  if (end) params.end = end;
  const { data } = await client().get('/loki/api/v1/labels', { params });
  return data.data;
}

// Get label values
async function getLabelValues(label, start = undefined, end = undefined) {
  const params = {};
  if (start) params.start = start;
  if (end) params.end = end;
  const { data } = await client().get(`/loki/api/v1/label/${label}/values`, { params });
  return data.data;
}

// Get log series
async function getSeries(match, start, end) {
  const params = { match, start, end };
  const { data } = await client().get('/loki/api/v1/series', { params });
  return data.data;
}

// Query logs for a specific service/namespace
async function queryServiceLogs(namespace, service, level = null, duration = '1h', limit = 200) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - parseDuration(duration);
  let logql = `{namespace="${namespace}", app="${service}"}`;
  if (level) logql += ` |= "${level}"`;
  return queryLogs(logql, limit, String(start) + '000000000', String(now) + '000000000');
}

// Search logs across all services
async function searchLogs(searchTerm, namespace = null, duration = '1h', limit = 200) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - parseDuration(duration);
  let logql = namespace ? `{namespace="${namespace}"}` : `{namespace=~".+"}`;
  logql += ` |= "${searchTerm}"`;
  return queryLogs(logql, limit, String(start) + '000000000', String(now) + '000000000');
}

// Tail logs (returns push-based connection setup info)
async function tailEndpoint(logql, delayFor = 0, limit = 100) {
  const baseURL = getBaseUrl();
  if (!baseURL) throw new Error('LOKI_URL not configured');
  const wsUrl = baseURL.replace(/^http/, 'ws');
  return {
    url: `${wsUrl}/loki/api/v1/tail`,
    params: { query: logql, delay_for: delayFor, limit },
  };
}

// Health check
async function healthCheck() {
  try {
    const baseURL = getBaseUrl();
    if (!baseURL) return { healthy: false, message: 'URL not configured' };
    const resp = await axios.get(`${baseURL}/ready`, { timeout: 5000 });
    return { healthy: resp.status === 200, message: 'Loki is ready' };
  } catch (err) {
    return { healthy: false, message: err.message };
  }
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
  queryLogs, queryInstant, getLabels, getLabelValues, getSeries,
  queryServiceLogs, searchLogs, tailEndpoint, healthCheck,
};
