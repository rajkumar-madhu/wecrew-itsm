// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Slack Integration Service
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const crypto = require('crypto');
const { config } = require('../config/env');
const logger = require('../utils/logger');

const SLACK_API = 'https://slack.com/api';

function headers() {
  return {
    Authorization: `Bearer ${config.slack.botToken}`,
    'Content-Type': 'application/json',
  };
}

// ── Messaging ──────────────────────────────────────────

async function postMessage(channel, text, blocks = null, threadTs = null) {
  if (!config.slack.botToken) { logger.warn('Slack not configured'); return null; }
  const payload = { channel, text };
  if (blocks) payload.blocks = blocks;
  if (threadTs) payload.thread_ts = threadTs;
  const { data } = await axios.post(`${SLACK_API}/chat.postMessage`, payload, { headers: headers() });
  if (!data.ok) logger.error('Slack postMessage error:', data.error);
  return data;
}

async function updateMessage(channel, ts, text, blocks = null) {
  const payload = { channel, ts, text };
  if (blocks) payload.blocks = blocks;
  const { data } = await axios.post(`${SLACK_API}/chat.update`, payload, { headers: headers() });
  return data;
}

// ── Incident Notification Blocks ───────────────────────

function buildIncidentBlocks(incident, event = 'Created') {
  const priorityEmoji = { P1: ':rotating_light:', P2: ':warning:', P3: ':information_source:', P4: ':white_circle:' };
  const stateEmoji = { NEW: ':new:', IN_PROGRESS: ':arrows_counterclockwise:', ESCALATED: ':arrow_up:', RESOLVED: ':white_check_mark:', CLOSED: ':lock:' };

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${priorityEmoji[incident.priority] || ''} Incident ${event}: ${incident.number}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${incident.shortDescription}*` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Priority:* ${incident.priority}` },
        { type: 'mrkdwn', text: `*State:* ${stateEmoji[incident.state] || ''} ${incident.state}` },
        { type: 'mrkdwn', text: `*Assigned:* ${incident.assignedTo?.firstName ? `${incident.assignedTo.firstName} ${incident.assignedTo.lastName}` : 'Unassigned'}` },
        { type: 'mrkdwn', text: `*Source:* ${incident.source}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Incident' },
          url: `${config.frontendUrl}/incidents/${incident.id}`,
          style: 'primary',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Acknowledge' },
          action_id: `ack_incident_${incident.id}`,
        },
      ],
    },
    { type: 'divider' },
  ];
}

function buildAlertBlocks(alert) {
  const severityEmoji = { CRITICAL: ':rotating_light:', WARNING: ':warning:', INFO: ':information_source:' };
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${severityEmoji[alert.severity] || ''} Alert: ${alert.name}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: alert.description || 'No description' },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Severity:* ${alert.severity}` },
        { type: 'mrkdwn', text: `*Source:* ${alert.source}` },
        { type: 'mrkdwn', text: `*Metric:* \`${alert.metric || 'N/A'}\`` },
        { type: 'mrkdwn', text: `*Value:* ${alert.currentValue || 'N/A'}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Create Incident' },
          action_id: `create_inc_from_alert_${alert.id}`,
          style: 'danger',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Acknowledge' },
          action_id: `ack_alert_${alert.id}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Silence (1h)' },
          action_id: `silence_alert_${alert.id}`,
        },
      ],
    },
  ];
}

// ── Send incident/alert notifications ──────────────────

async function notifyIncident(incident, event = 'Created') {
  const channel = config.slack.defaultChannel;
  const text = `[${incident.priority}] Incident ${event}: ${incident.number} — ${incident.shortDescription}`;
  const blocks = buildIncidentBlocks(incident, event);
  return postMessage(channel, text, blocks);
}

async function notifyAlert(alert) {
  const channel = config.slack.defaultChannel;
  const text = `[${alert.severity}] Alert: ${alert.name}`;
  const blocks = buildAlertBlocks(alert);
  return postMessage(channel, text, blocks);
}

async function notifySLABreach(incident) {
  const channel = config.slack.defaultChannel;
  const text = `:rotating_light: SLA BREACHED: ${incident.number} (${incident.priority}) — ${incident.shortDescription}`;
  return postMessage(channel, text);
}

// ── Slash Command Handlers ─────────────────────────────

async function handleSlashCommand(command, text, responseUrl) {
  switch (command) {
    case '/le-status':
      return { response_type: 'in_channel', text: 'LinkedEye Status: All systems operational' };
    case '/le-incident':
      return { response_type: 'ephemeral', text: `Looking up incident: ${text}...` };
    case '/le-oncall':
      return { response_type: 'in_channel', text: 'Fetching on-call schedule...' };
    default:
      return { response_type: 'ephemeral', text: `Unknown command: ${command}` };
  }
}

// ── Verify Slack Signature ─────────────────────────────

function verifySignature(signingSecret, signature, timestamp, body) {
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');
  const computed = `v0=${hmac}`;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

// ── Channels ───────────────────────────────────────────

async function listChannels(limit = 100) {
  const { data } = await axios.get(`${SLACK_API}/conversations.list`, {
    headers: headers(),
    params: { limit, types: 'public_channel,private_channel' },
  });
  return data.channels || [];
}

// ── Health ─────────────────────────────────────────────

async function healthCheck() {
  try {
    if (!config.slack.botToken) return { healthy: false, message: 'Bot token not configured' };
    const { data } = await axios.get(`${SLACK_API}/auth.test`, { headers: headers() });
    return { healthy: data.ok, user: data.user, team: data.team, message: data.ok ? 'Connected' : data.error };
  } catch (err) {
    return { healthy: false, message: err.message };
  }
}

module.exports = {
  postMessage, updateMessage,
  buildIncidentBlocks, buildAlertBlocks,
  notifyIncident, notifyAlert, notifySLABreach,
  handleSlashCommand, verifySignature,
  listChannels, healthCheck,
};
