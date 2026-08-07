// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — PagerDuty Integration Service
// Bidirectional sync: LinkedEye ↔ PagerDuty REST API v2
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const logger = require('../utils/logger');

const PD_BASE = 'https://api.pagerduty.com';
const PD_EVENTS = 'https://events.pagerduty.com/v2/enqueue';

// ── Authenticated PagerDuty REST API client ──────────────
function pdClient(apiKey) {
  return axios.create({
    baseURL: PD_BASE,
    timeout: 15000,
    headers: {
      Authorization: `Token token=${apiKey}`,
      Accept: 'application/vnd.pagerduty+json;version=2',
      'Content-Type': 'application/json',
    },
  });
}

// ── Validate API Key + fetch account context ─────────────
async function validateApiKey(apiKey) {
  try {
    const client = pdClient(apiKey);
    const { data } = await client.get('/users/me', { params: { include: ['contact_methods'] } });
    const user = data.user;
    return {
      valid: true,
      account: {
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatar_url,
        htmlUrl: user.html_url,
        id: user.id,
      },
    };
  } catch (err) {
    const status = err.response?.status;
    return {
      valid: false,
      error: status === 401 ? 'Invalid API key' : status === 403 ? 'Insufficient permissions' : err.message,
    };
  }
}

// ── Fetch all services for the account ───────────────────
async function getServices(apiKey) {
  try {
    const client = pdClient(apiKey);
    let allServices = [];
    let offset = 0;
    const limit = 100;
    while (true) {
      const { data } = await client.get('/services', {
        params: { limit, offset, include: ['integrations', 'escalation_policies'], 'sort_by': 'name' },
      });
      allServices = [...allServices, ...data.services];
      if (!data.more) break;
      offset += limit;
    }
    return allServices.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      status: s.status, // active, warning, critical, maintenance, disabled
      htmlUrl: s.html_url,
      escalationPolicy: s.escalation_policy ? {
        id: s.escalation_policy.id,
        name: s.escalation_policy.summary,
      } : null,
      integrationsCount: s.integrations?.length || 0,
      incidentUrgencyRule: s.incident_urgency_rule?.type,
      createdAt: s.created_at,
    }));
  } catch (err) {
    logger.error('[PagerDuty] getServices error: %s', err.message);
    throw err;
  }
}

// ── Fetch active + recent incidents ──────────────────────
async function getIncidents(apiKey, options = {}) {
  try {
    const client = pdClient(apiKey);
    const params = {
      limit: options.limit || 25,
      offset: options.offset || 0,
      'statuses[]': options.statuses || ['triggered', 'acknowledged'],
      'sort_by': 'created_at:desc',
      include: ['assignees', 'first_trigger_log_entries', 'services'],
    };
    if (options.serviceId) params['service_ids[]'] = options.serviceId;
    if (options.since) params.since = options.since;
    if (options.until) params.until = options.until;

    const { data } = await client.get('/incidents', { params });
    return {
      total: data.total,
      incidents: data.incidents.map(i => ({
        id: i.id,
        incidentNumber: i.incident_number,
        title: i.title,
        status: i.status,
        urgency: i.urgency,
        priority: i.priority?.name || null,
        service: { id: i.service?.id, name: i.service?.summary },
        assignees: i.assignments?.map(a => ({
          id: a.assignee?.id,
          name: a.assignee?.summary,
          htmlUrl: a.assignee?.html_url,
        })) || [],
        createdAt: i.created_at,
        resolvedAt: i.resolved_at,
        htmlUrl: i.html_url,
        body: i.first_trigger_log_entry?.channel?.body || null,
      })),
    };
  } catch (err) {
    logger.error('[PagerDuty] getIncidents error: %s', err.message);
    throw err;
  }
}

// ── Fetch who is currently on-call ───────────────────────
async function getOnCalls(apiKey) {
  try {
    const client = pdClient(apiKey);
    const { data } = await client.get('/oncalls', {
      params: {
        include: ['users', 'schedules', 'escalation_policies'],
        limit: 100,
      },
    });
    // Group by escalation policy → layer
    const grouped = {};
    for (const oc of data.oncalls) {
      const epId = oc.escalation_policy?.id;
      if (!epId) continue;
      if (!grouped[epId]) {
        grouped[epId] = {
          escalationPolicy: { id: epId, name: oc.escalation_policy.summary },
          layers: [],
        };
      }
      grouped[epId].layers.push({
        level: oc.escalation_level,
        user: { id: oc.user?.id, name: oc.user?.summary, htmlUrl: oc.user?.html_url },
        schedule: oc.schedule ? { id: oc.schedule.id, name: oc.schedule.summary } : null,
        start: oc.start,
        end: oc.end,
      });
    }
    return Object.values(grouped);
  } catch (err) {
    logger.error('[PagerDuty] getOnCalls error: %s', err.message);
    throw err;
  }
}

// ── Fetch escalation policies ─────────────────────────────
async function getEscalationPolicies(apiKey) {
  try {
    const client = pdClient(apiKey);
    const { data } = await client.get('/escalation_policies', {
      params: { limit: 50, include: ['services'] },
    });
    return data.escalation_policies.map(ep => ({
      id: ep.id,
      name: ep.name,
      description: ep.description || '',
      numLoops: ep.num_loops,
      onCallHandoffNotifications: ep.on_call_handoff_notifications,
      rules: ep.escalation_rules?.map(r => ({
        escalationDelayMinutes: r.escalation_delay_in_minutes,
        targets: r.targets?.map(t => ({ id: t.id, type: t.type, name: t.summary })) || [],
      })) || [],
      services: ep.services?.map(s => ({ id: s.id, name: s.summary })) || [],
    }));
  } catch (err) {
    logger.error('[PagerDuty] getEscalationPolicies error: %s', err.message);
    throw err;
  }
}

// ── Fetch users in the account ───────────────────────────
async function getUsers(apiKey) {
  try {
    const client = pdClient(apiKey);
    const { data } = await client.get('/users', { params: { limit: 100 } });
    return data.users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatarUrl: u.avatar_url,
      htmlUrl: u.html_url,
      jobTitle: u.job_title || '',
      billed: u.billed,
    }));
  } catch (err) {
    logger.error('[PagerDuty] getUsers error: %s', err.message);
    throw err;
  }
}

// ── Fetch account-level incident stats ───────────────────
async function getIncidentStats(apiKey) {
  try {
    const client = pdClient(apiKey);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [triggered, acknowledged, resolved] = await Promise.all([
      client.get('/incidents', { params: { 'statuses[]': ['triggered'], limit: 1, since } }),
      client.get('/incidents', { params: { 'statuses[]': ['acknowledged'], limit: 1, since } }),
      client.get('/incidents', { params: { 'statuses[]': ['resolved'], limit: 1, since } }),
    ]);
    return {
      triggered: triggered.data.total,
      acknowledged: acknowledged.data.total,
      resolved: resolved.data.total,
      total: triggered.data.total + acknowledged.data.total + resolved.data.total,
      sinceDate: since,
    };
  } catch (err) {
    logger.error('[PagerDuty] getIncidentStats error: %s', err.message);
    return { triggered: 0, acknowledged: 0, resolved: 0, total: 0 };
  }
}

// ── Send alert event via Events API v2 ───────────────────
async function sendEvent(routingKey, payload) {
  try {
    const { data } = await axios.post(PD_EVENTS, {
      routing_key: routingKey,
      event_action: payload.action || 'trigger',
      dedup_key: payload.dedupKey,
      payload: {
        summary: payload.summary,
        severity: payload.severity || 'critical',
        source: payload.source || 'LinkedEye',
        component: payload.component,
        group: payload.group,
        class: payload.class || 'PROMETHEUS',
        custom_details: payload.customDetails || {},
      },
      links: payload.links || [],
    }, { timeout: 10000 });
    return { success: true, dedupKey: data.dedup_key, status: data.status };
  } catch (err) {
    logger.error('[PagerDuty] sendEvent error: %s', err.message);
    throw err;
  }
}

// ── Resolve an event via Events API v2 ───────────────────
async function resolveEvent(routingKey, dedupKey) {
  return sendEvent(routingKey, { action: 'resolve', dedupKey });
}

// ── Acknowledge an event via Events API v2 ───────────────
async function acknowledgeEvent(routingKey, dedupKey) {
  return sendEvent(routingKey, { action: 'acknowledge', dedupKey });
}

// ── Fetch full overview (batched parallel calls) ──────────
async function getOverview(apiKey) {
  const [services, onCalls, stats, incidents, users] = await Promise.allSettled([
    getServices(apiKey),
    getOnCalls(apiKey),
    getIncidentStats(apiKey),
    getIncidents(apiKey, { limit: 10, statuses: ['triggered', 'acknowledged'] }),
    getUsers(apiKey),
  ]);

  return {
    services: services.status === 'fulfilled' ? services.value : [],
    onCalls: onCalls.status === 'fulfilled' ? onCalls.value : [],
    stats: stats.status === 'fulfilled' ? stats.value : {},
    activeIncidents: incidents.status === 'fulfilled' ? incidents.value.incidents : [],
    users: users.status === 'fulfilled' ? users.value : [],
    fetchedAt: new Date().toISOString(),
  };
}

// ── Process incoming PagerDuty webhook (V3) ──────────────
function parseWebhookEvent(body) {
  try {
    // PD V3 webhook format
    if (body.event?.event_type) {
      const evt = body.event;
      return {
        type: evt.event_type,         // incident.triggered, incident.resolved, etc.
        incident: evt.data,
        triggeredAt: evt.occurred_at,
        accountId: body.account?.id,
      };
    }
    // Legacy V1/V2 format
    if (body.messages) {
      return body.messages.map(m => ({
        type: m.event,
        incident: m.incident,
        triggeredAt: m.created_on,
      }));
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = {
  validateApiKey,
  getServices,
  getIncidents,
  getOnCalls,
  getEscalationPolicies,
  getUsers,
  getIncidentStats,
  getOverview,
  sendEvent,
  resolveEvent,
  acknowledgeEvent,
  parseWebhookEvent,
};
