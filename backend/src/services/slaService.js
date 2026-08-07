// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — SLA Service
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { emitToAll, emitToUser } = require('../config/socket');
const { createNotification } = require('./notificationService');
const emailService = require('./emailService');
const { SLA_DEFAULTS } = require('../config/constants');
const logger = require('../utils/logger');

// Check SLA compliance for all open incidents (called by cron)
async function checkSLACompliance() {
  try {
    const now = new Date();
    const openIncidents = await prisma.incident.findMany({
      where: {
        state: { in: ['NEW', 'IN_PROGRESS', 'ESCALATED'] },
        slaBreached: false,
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        assignmentGroup: { select: { id: true, name: true } },
      },
    });

    for (const incident of openIncidents) {
      // Check response SLA
      if (incident.slaTargetResponse && now > incident.slaTargetResponse && !incident.responseTime) {
        await handleSLABreach(incident, 'response');
      }

      // Check resolution SLA
      if (incident.slaTargetResolution && now > incident.slaTargetResolution) {
        await handleSLABreach(incident, 'resolution');
      }

      // 80% warning threshold
      if (incident.slaTargetResolution && !incident.slaBreached) {
        const created = incident.createdAt.getTime();
        const target = incident.slaTargetResolution.getTime();
        const elapsed = now.getTime() - created;
        const total = target - created;
        const percentage = (elapsed / total) * 100;

        if (percentage >= 80 && percentage < 100) {
          const remainingMinutes = Math.round((target - now.getTime()) / 60000);
          emitToAll('incident:sla-warning', {
            id: incident.id, number: incident.number, priority: incident.priority,
            percentage: Math.round(percentage),
          });
          if (incident.assignedToId) {
            await createNotification(
              incident.assignedToId, 'SLA',
              `SLA Warning: ${incident.number}`,
              `${Math.round(percentage)}% of SLA time elapsed`,
              `/incidents/${incident.id}`
            );
          }
          if (incident.assignedTo?.email) {
            const subject = `SLA Warning: ${incident.number} — ${remainingMinutes}min remaining`;
            const html = emailService.templates.slaWarning(incident, remainingMinutes);
            emailService.sendEmail(incident.assignedTo.email, subject, html);
          }
        }
      }
    }
  } catch (err) {
    logger.error('SLA check failed:', err);
  }
}

async function handleSLABreach(incident, type) {
  await prisma.incident.update({
    where: { id: incident.id },
    data: { slaBreached: true },
  });

  await prisma.activity.create({
    data: {
      action: 'SLA_BREACHED',
      description: `SLA ${type} target breached for ${incident.number}`,
      incidentId: incident.id,
    },
  });

  emitToAll('incident:sla-breached', {
    id: incident.id, number: incident.number, priority: incident.priority, type,
  });

  if (incident.assignedToId) {
    await createNotification(
      incident.assignedToId, 'SLA',
      `SLA BREACHED: ${incident.number}`,
      `${type} SLA target exceeded`,
      `/incidents/${incident.id}`
    );
  }

  if (incident.assignedTo?.email) {
    const subject = `SLA BREACHED: ${incident.number} — Immediate action required`;
    const html = emailService.templates.slaBreached(incident);
    emailService.sendEmail(incident.assignedTo.email, subject, html);
  }

  logger.warn(`SLA ${type} breached: ${incident.number} (${incident.priority})`);
}

// Pause SLA when incident is ON_HOLD
async function pauseSLA(incidentId) {
  await prisma.incident.update({
    where: { id: incidentId },
    data: { slaPausedAt: new Date() },
  });
}

// Resume SLA when back to IN_PROGRESS
async function resumeSLA(incidentId) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident?.slaPausedAt) return;

  const pausedMs = Date.now() - incident.slaPausedAt.getTime();
  const pausedMinutes = Math.floor(pausedMs / 60000);

  await prisma.incident.update({
    where: { id: incidentId },
    data: {
      slaPausedAt: null,
      slaPausedDuration: incident.slaPausedDuration + pausedMinutes,
      slaTargetResolution: incident.slaTargetResolution
        ? new Date(incident.slaTargetResolution.getTime() + pausedMs)
        : null,
    },
  });
}

module.exports = { checkSLACompliance, pauseSLA, resumeSLA };
