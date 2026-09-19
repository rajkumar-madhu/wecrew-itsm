// ═══════════════════════════════════════════════════════════
// Argus ITSM — On-Call Auto-Escalation Engine
// Runs every 60s, escalates unacknowledged P1/P2 incidents
// through team escalation policies (L1 → L2 → L3)
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const config = require('../config/env');
const logger = require('../utils/logger');

// Lazy-load to avoid circular deps
let _voiceService, _notificationService;
function getVoiceService() { if (!_voiceService) _voiceService = require('./voiceService'); return _voiceService; }
function getNotificationService() { if (!_notificationService) _notificationService = require('./notificationService'); return _notificationService; }

// Check channel availability once at startup
const hasTwilio = !!(config.twilio?.accountSid && config.twilio?.authToken);
const hasSlack = !!config.slack?.botToken;
const hasSMTP = !!(config.smtp?.user && config.smtp?.pass);

let isRunning = false;

/**
 * Main escalation loop — checks P1/P2 incidents in NEW state
 * and escalates through the team's escalation policy rules.
 */

// Escalation targets are tenant-supplied ids/emails. Only page people in the
// incident's own org, or WeCrew operator staff (the platform org), so one
// tenant cannot call, text or email another tenant's people.
const PLATFORM_ORG_SLUG = process.env.PLATFORM_ORG_SLUG || 'wecrew';
function escalationTargetScope(incident) {
  return {
    OR: [
      ...(incident.organizationId ? [{ organizationId: incident.organizationId }] : []),
      { organization: { is: { slug: PLATFORM_ORG_SLUG } } },
    ],
  };
}

async function checkEscalations() {
  if (isRunning) return;
  isRunning = true;

  try {
    // Fetch P1/P2 incidents in NEW or IN_PROGRESS that have an assigned team.
    // IN_PROGRESS included so escalation continues even after acknowledgment —
    // resolving (RESOLVED/CLOSED) is the only thing that stops the chain.
    const incidents = await prisma.incident.findMany({
      where: {
        priority: { in: ['P1', 'P2'] },
        state: { in: ['NEW', 'ESCALATED', 'IN_PROGRESS'] },
        assignmentGroupId: { not: null },
      },
      include: {
        assignmentGroup: {
          include: {
            escalationPolicies: {
              where: { isActive: true },
              include: {
                rules: { orderBy: { level: 'asc' } },
              },
            },
          },
        },
        organization: { select: { id: true, name: true, preferredLanguage: true } },
      },
    });

    if (incidents.length === 0) { isRunning = false; return; }

    const now = new Date();

    for (const incident of incidents) {
      try {
        const policy = incident.assignmentGroup?.escalationPolicies?.[0];
        if (!policy || !policy.rules?.length) continue;

        const elapsedMs = now - new Date(incident.createdAt);
        const elapsedMin = elapsedMs / 60000;

        // Find the highest level that should have been reached by now
        let targetLevel = 0;
        for (const rule of policy.rules) {
          if (elapsedMin >= rule.delayMinutes && rule.level > incident.escalationLevel) {
            targetLevel = rule.level;
          }
        }

        if (targetLevel <= incident.escalationLevel) continue;

        // Get the rule for the target level
        const rule = policy.rules.find(r => r.level === targetLevel);
        if (!rule) continue;

        logger.info(`[Escalation] ${incident.number} → Level ${targetLevel} (elapsed: ${Math.floor(elapsedMin)}min, delay: ${rule.delayMinutes}min)`);

        // Skip rule if it has a priority condition that doesn't match this incident
        if (rule.conditionPriority && rule.conditionPriority !== incident.priority) {
          logger.info(`[Escalation] ${incident.number} L${targetLevel} skipped — conditionPriority=${rule.conditionPriority}, incident=${incident.priority}`);
          continue;
        }

        // Parse notify targets — supports both user IDs and email addresses
        const rawTargets = rule.notifyTargets.split(',').map(t => t.trim()).filter(Boolean);
        const emailTargets = rawTargets.filter(t => t.includes('@'));
        const idTargets = rawTargets.filter(t => !t.includes('@'));

        const targetUsers = await prisma.user.findMany({
          where: {
            OR: [
              ...(idTargets.length    ? [{ id:    { in: idTargets } }]    : []),
              ...(emailTargets.length ? [{ email: { in: emailTargets } }] : []),
            ],
            AND: [escalationTargetScope(incident)],
          },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, preferredLanguage: true },
        });

        // Notify each target
        for (const user of targetUsers) {
          await notifyEscalationTarget(incident, rule, user);
        }

        // Update incident escalation level
        await prisma.incident.update({
          where: { id: incident.id },
          data: {
            escalationLevel: targetLevel,
            lastEscalatedAt: now,
          },
        });

        // Create activity
        const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN', isPlatformAdmin: true }, select: { id: true } });
        if (systemUser) {
          await prisma.activity.create({
            data: {
              action: 'ESCALATION',
              description: `Auto-escalated to Level ${targetLevel} (${rule.notifyType}). Targets: ${targetUsers.map(u => `${u.firstName} ${u.lastName}`).join(', ')}`,
              incidentId: incident.id,
              userId: systemUser.id,
            },
          });
        }

        logger.info(`[Escalation] ${incident.number} escalated to L${targetLevel}, notified ${targetUsers.length} targets`);
      } catch (incErr) {
        logger.error(`[Escalation] Failed for ${incident.number}: ${incErr.message}`);
      }
    }
  } catch (err) {
    logger.error(`[Escalation] Engine error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

/**
 * Notify a single escalation target via the specified channel.
 */
async function notifyEscalationTarget(incident, rule, user) {
  const notifService = getNotificationService();
  const lang = user.preferredLanguage || incident.organization?.preferredLanguage || 'en';
  const callSids = [];
  const channels = [];

  const escalationMsg = `[Escalation L${rule.level}] ${incident.number} (${incident.priority}) — ${incident.shortDescription}`;

  try {
    const wantsVoice = rule.notifyType === 'VOICE_NOTIFY' || rule.notifyType === 'ALL';
    const wantsSMS = rule.notifyType === 'SMS_NOTIFY' || rule.notifyType === 'ALL';
    const wantsEmail = rule.notifyType === 'EMAIL_NOTIFY' || rule.notifyType === 'ALL';
    const wantsSlack = rule.notifyType === 'SLACK_NOTIFY' || rule.notifyType === 'ALL';

    // Voice — only if Twilio configured and user has phone
    if (wantsVoice && hasTwilio && user.phone) {
      const voiceService = getVoiceService();
      const result = await voiceService.incidentAlertCall(incident, user.phone, lang);
      callSids.push(result?.callSid);
      channels.push('voice');
    }

    // SMS — only if Twilio configured and user has phone
    if (wantsSMS && hasTwilio && user.phone) {
      await notifService.sendSMS(user.phone, escalationMsg, incident.id);
      channels.push('sms');
    }

    // Email
    if (wantsEmail && user.email) {
      const emailService = require('./emailService');
      await notifService.sendEmail(user.email, emailService.buildIncidentSubject(incident, 'Escalated'), emailService.templates.incidentEscalated(incident));
      channels.push('email');
    }

    // Slack
    if (wantsSlack && hasSlack) {
      await notifService.sendSlackMessage(null, `:rotating_light: *Escalation L${rule.level}* — ${incident.number} (${incident.priority})\n${incident.shortDescription}`);
      channels.push('slack');
    }

    // Log the escalation attempt
    await prisma.escalationLog.create({
      data: {
        incidentId: incident.id,
        level: rule.level,
        notifyType: rule.notifyType,
        targetContact: user.phone || user.email || 'unknown',
        targetUserId: user.id,
        targetName: `${user.firstName} ${user.lastName}`,
        status: channels.length > 0 ? 'ATTEMPTED' : 'SKIPPED',
        callSid: callSids[0] || null,
        notes: channels.length > 0 ? `Channels: ${channels.join(', ')}` : 'No notification channels configured',
      },
    });
  } catch (err) {
    // Log failure
    await prisma.escalationLog.create({
      data: {
        incidentId: incident.id,
        level: rule.level,
        notifyType: rule.notifyType,
        targetContact: user.phone || user.email || 'unknown',
        targetUserId: user.id,
        targetName: `${user.firstName} ${user.lastName}`,
        status: 'FAILED',
        notes: err.message,
      },
    }).catch(() => {});
    logger.error(`[Escalation] Notify failed for ${user.email}: ${err.message}`);
  }
}

/**
 * Retry escalation — called when a voice call goes unanswered.
 * Tries the next target at the same level, or marks level as exhausted.
 */
async function retryEscalation(incidentId) {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        assignmentGroup: {
          include: {
            escalationPolicies: {
              where: { isActive: true },
              include: { rules: { orderBy: { level: 'asc' } } },
            },
          },
        },
        organization: { select: { id: true, name: true, preferredLanguage: true } },
      },
    });

    if (!incident || incident.state !== 'NEW') return;

    const policy = incident.assignmentGroup?.escalationPolicies?.[0];
    if (!policy) return;

    const currentRule = policy.rules.find(r => r.level === incident.escalationLevel);
    if (!currentRule) return;

    // Get all targets at the current level
    const targetIds = currentRule.notifyTargets.split(',').map(t => t.trim()).filter(Boolean);

    // Find which targets have already been attempted
    const attemptedLogs = await prisma.escalationLog.findMany({
      where: { incidentId, level: incident.escalationLevel },
      select: { targetUserId: true, status: true },
    });
    const attemptedUserIds = new Set(attemptedLogs.map(l => l.targetUserId));

    // Find unattempted targets
    const remaining = targetIds.filter(id => !attemptedUserIds.has(id));
    if (remaining.length === 0) {
      logger.info(`[Escalation] All L${incident.escalationLevel} targets exhausted for ${incident.number}`);
      return;
    }

    // Try next target
    const nextUserId = remaining[0];
    const nextUser = await prisma.user.findFirst({
      where: { id: nextUserId, ...escalationTargetScope(incident) },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, preferredLanguage: true },
    });

    if (nextUser) {
      logger.info(`[Escalation] Retrying L${incident.escalationLevel} → ${nextUser.firstName} ${nextUser.lastName} for ${incident.number}`);
      await notifyEscalationTarget(incident, currentRule, nextUser);
    }
  } catch (err) {
    logger.error(`[Escalation] Retry failed for incident ${incidentId}: ${err.message}`);
  }
}

module.exports = { checkEscalations, retryEscalation };
