// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Grafana Integration Service
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const { config } = require('../config/env');
const logger = require('../utils/logger');

function client() {
  const baseURL = config.observability.grafanaUrl;
  if (!baseURL) throw new Error('GRAFANA_URL not configured');
  const headers = { 'Content-Type': 'application/json' };
  if (config.observability.grafanaApiKey) {
    headers.Authorization = `Bearer ${config.observability.grafanaApiKey}`;
  }
  return axios.create({ baseURL, headers, timeout: 10000 });
}

// ── Dashboards ─────────────────────────────────────────

async function searchDashboards(query = '', tag = undefined) {
  const params = { type: 'dash-db' };
  if (query) params.query = query;
  if (tag) params.tag = tag;
  const { data } = await client().get('/api/search', { params });
  return data;
}

async function getDashboard(uid) {
  const { data } = await client().get(`/api/dashboards/uid/${uid}`);
  return data;
}

// ── Annotations (mark incidents/changes on graphs) ─────

async function createAnnotation(text, tags = [], dashboardId = 0, time = Date.now()) {
  const { data } = await client().post('/api/annotations', {
    dashboardId,
    time,
    text,
    tags,
  });
  return data;
}

async function createIncidentAnnotation(incident) {
  const text = `[${incident.priority}] ${incident.number}: ${incident.shortDescription}`;
  const tags = ['incident', incident.priority, incident.state];
  return createAnnotation(text, tags);
}

async function createChangeAnnotation(change) {
  const text = `[${change.type}] ${change.number}: ${change.shortDescription}`;
  const tags = ['change', change.type, change.risk];
  const time = new Date(change.scheduledStart).getTime();
  return createAnnotation(text, tags, 0, time);
}

async function getAnnotations(from, to, tags = []) {
  const params = { from, to };
  if (tags.length) params.tags = tags.join(',');
  const { data } = await client().get('/api/annotations', { params });
  return data;
}

// ── Datasources ────────────────────────────────────────

async function listDatasources() {
  const { data } = await client().get('/api/datasources');
  return data;
}

async function getDatasource(id) {
  const { data } = await client().get(`/api/datasources/${id}`);
  return data;
}

async function testDatasource(id) {
  const ds = await getDatasource(id);
  const { data } = await client().post(`/api/datasources/proxy/${id}/api/v1/query`, null, {
    params: { query: '1+1' },
  });
  return { datasource: ds.name, success: true };
}

// ── Alert Rules ────────────────────────────────────────

async function getAlertRules() {
  const { data } = await client().get('/api/v1/provisioning/alert-rules');
  return data;
}

async function getAlertNotifications() {
  const { data } = await client().get('/api/alert-notifications');
  return data;
}

// ── Snapshots ──────────────────────────────────────────

async function createSnapshot(dashboard, expires = 3600) {
  const { data } = await client().post('/api/snapshots', {
    dashboard,
    expires,
  });
  return data;
}

// ── Render Panel (image export) ────────────────────────

function renderPanelUrl(dashboardUid, panelId, from = 'now-6h', to = 'now', width = 1000, height = 500) {
  const baseURL = config.observability.grafanaUrl;
  return `${baseURL}/render/d-solo/${dashboardUid}?panelId=${panelId}&from=${from}&to=${to}&width=${width}&height=${height}`;
}

// ── Health Check ───────────────────────────────────────

async function healthCheck() {
  try {
    const baseURL = config.observability.grafanaUrl;
    if (!baseURL) return { healthy: false, message: 'URL not configured' };
    const { data } = await axios.get(`${baseURL}/api/health`, { timeout: 5000 });
    return { healthy: data.database === 'ok', version: data.version, message: data.database === 'ok' ? 'Grafana healthy' : 'Database unhealthy' };
  } catch (err) {
    return { healthy: false, message: err.message };
  }
}

module.exports = {
  searchDashboards, getDashboard,
  createAnnotation, createIncidentAnnotation, createChangeAnnotation, getAnnotations,
  listDatasources, getDatasource, testDatasource,
  getAlertRules, getAlertNotifications,
  createSnapshot, renderPanelUrl, healthCheck,
};
