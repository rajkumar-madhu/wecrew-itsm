// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Central Event Bus
// ═══════════════════════════════════════════════════════════

const EventEmitter = require('events');
const { emitToAll, emitToTeam, emitToUser } = require('../config/socket');
const { createNotification, notifyIncidentStakeholders, sendSlackMessage } = require('./notificationService');
const logger = require('../utils/logger');

const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

// ── Incident Events ─────────────────────────────────────

eventBus.on('INCIDENT_CREATED', async (incident) => {
  emitToAll('incident:created', { id: incident.id, number: incident.number, priority: incident.priority });
  await notifyIncidentStakeholders(incident, 'Created');
});

eventBus.on('INCIDENT_UPDATED', async (incident) => {
  emitToAll('incident:updated', { id: incident.id, number: incident.number, state: incident.state });
});

eventBus.on('INCIDENT_ESCALATED', async (incident) => {
  emitToAll('incident:escalated', { id: incident.id, number: incident.number, priority: incident.priority });
  await notifyIncidentStakeholders(incident, 'Escalated');
});

eventBus.on('INCIDENT_RESOLVED', async (incident) => {
  emitToAll('incident:resolved', { id: incident.id, number: incident.number });
  await notifyIncidentStakeholders(incident, 'Resolved');
});

eventBus.on('INCIDENT_SLA_BREACHED', async (data) => {
  emitToAll('incident:sla-breached', data);
  await sendSlackMessage(null, `:rotating_light: *SLA BREACHED* — ${data.number} (${data.priority})`);
});

// ── Change Events ───────────────────────────────────────

eventBus.on('CHANGE_APPROVED', async (change) => {
  emitToAll('change:approved', { id: change.id, number: change.number });
  if (change.assignedToId) {
    await createNotification(change.assignedToId, 'CHANGE', `Change Approved: ${change.number}`, change.shortDescription, `/changes/${change.id}`);
  }
});

eventBus.on('CHANGE_REJECTED', async (change) => {
  emitToAll('change:rejected', { id: change.id, number: change.number });
});

// ── Alert Events ────────────────────────────────────────

eventBus.on('ALERT_FIRED', async (alert) => {
  emitToAll('alert:fired', { id: alert.id, name: alert.name, severity: alert.severity });
  if (alert.severity === 'CRITICAL') {
    await sendSlackMessage(null, `:fire: *CRITICAL ALERT* — ${alert.name}\n${alert.description || ''}`);
  }
});

eventBus.on('ALERT_RESOLVED', async (alert) => {
  emitToAll('alert:resolved', { id: alert.id, name: alert.name });
});

// ── Voice Events ─────────────────────────────────────────

eventBus.on('VOICE_CALL_COMPLETED', async (data) => {
  emitToAll('voice:call-completed', {
    callId: data.callLog?.id,
    incidentNumber: data.incident?.number,
  });
});

// ── Escalation Events ───────────────────────────────────

eventBus.on('ESCALATION_RETRY_NEEDED', async (data) => {
  try {
    // Lazy-load to avoid circular dependency
    const { retryEscalation } = require('./escalationService');
    await retryEscalation(data.incidentId);
  } catch (err) {
    logger.error(`[Escalation] Retry event handler failed: ${err.message}`);
  }
});

module.exports = eventBus;
