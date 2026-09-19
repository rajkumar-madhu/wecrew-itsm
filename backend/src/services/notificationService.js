// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Notification Service (Multi-Channel)
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { config } = require('../config/env');
const { emitToUser } = require('../config/socket');
const axios = require('axios');
const logger = require('../utils/logger');
const emailService = require('./emailService');

// ── Web Notification ────────────────────────────────────

async function createNotification(userId, type, title, message, link = null) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, link, channel: 'WEB' },
    });
    emitToUser(userId, 'notification:new', notification);
    return notification;
  } catch (err) {
    logger.error('Failed to create notification', err);
  }
}

// ── Email (delegates to emailService) ────────────────────
// TEMP PAUSE: only rajkumar.madhu@wecrew.in receives email alerts
const EMAIL_ALLOWLIST = ['rajkumar.madhu@wecrew.in'];

async function sendEmail(to, subject, html) {
  if (!EMAIL_ALLOWLIST.includes((to || '').toLowerCase())) {
    logger.info(`[notificationService] Email suppressed for ${to} (not in allowlist)`);
    return;
  }
  await emailService.sendEmail(to, subject, html);
}

// ── Slack ───────────────────────────────────────────────

async function sendSlackMessage(channel, text, blocks = null) {
  try {
    if (!config.slack.botToken) { logger.warn('Slack not configured'); return; }
    await axios.post('https://slack.com/api/chat.postMessage', {
      channel: channel || config.slack.defaultChannel,
      text,
      blocks,
    }, { headers: { Authorization: `Bearer ${config.slack.botToken}`, 'Content-Type': 'application/json' } });
  } catch (err) {
    logger.error('Slack message failed:', err.message);
  }
}

// ── Telegram ────────────────────────────────────────────

async function sendTelegram(text, chatId = null) {
  try {
    const token = config.telegram?.botToken;
    const chat = chatId || config.telegram?.defaultChatId;
    if (!token || !chat) { logger.warn('Telegram not configured'); return; }
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chat,
      parse_mode: 'HTML',
      text,
    }, { timeout: 10000 });
  } catch (err) {
    logger.error('Telegram message failed:', err.message);
  }
}

function buildTelegramAlert(incident, event) {
  const emoji = incident.priority === 'P1' ? '🔴' : incident.priority === 'P2' ? '🟠' : incident.priority === 'P3' ? '🟡' : '🟢';
  const hostMatch = incident.description?.match(/Host:\s*(\S+)/i);
  const hostname = hostMatch?.[1] || '';
  return [
    `${emoji} <b>WeCrew ITSM Alert</b>`,
    ``,
    `<b>${incident.number} | ${incident.priority} | ${event}</b>`,
    `<b>Issue:</b> ${incident.shortDescription}`,
    hostname ? `<b>Host:</b> ${hostname}` : null,
    `<b>Impact:</b> ${incident.impact} | <b>Urgency:</b> ${incident.urgency}`,
    incident.category ? `<b>Category:</b> ${incident.category}` : null,
    incident.assignedTo ? `<b>Assigned:</b> ${incident.assignedTo.firstName || ''} ${incident.assignedTo.lastName || ''}` : null,
    ``,
    `⚡ Action Required: Acknowledge or Escalate`,
  ].filter(Boolean).join('\n');
}

// ── Voice (incident alert calls) ────────────────────────

const voiceService = require('./voiceService');

async function sendVoiceAlert(incident, phoneNumber, lang = null) {
  try {
    const callLang = lang || incident.organization?.preferredLanguage || 'en';
    await voiceService.incidentAlertCall(incident, phoneNumber, callLang);
  } catch (err) {
    logger.error(`Voice alert failed for ${incident.number}: ${err.message}`);
  }
}

// ── SMS (delegates to smsService) ───────────────────────

const smsService = require('./smsService');

async function sendSMS(recipient, message, incidentId = null) {
  try {
    await smsService.sendSMS(recipient, message, { incidentId });
  } catch (err) {
    logger.error('SMS failed:', err.message);
  }
}

// ── Fan-out by Priority ─────────────────────────────────

async function notifyIncidentStakeholders(incident, event) {
  const title   = emailService.buildIncidentSubject(incident, event);
  const message = incident.shortDescription;
  const link    = `/incidents/${incident.id}`;

  // Always send WebSocket + DB notification
  if (incident.assignedToId) {
    await createNotification(incident.assignedToId, 'INCIDENT', title, message, link);
  }
  if (incident.createdById && incident.createdById !== incident.assignedToId) {
    await createNotification(incident.createdById, 'INCIDENT', title, message, link);
  }

  // Priority-based channels
  const slackText = `*${title}*\n${message}`;

  // Determine which email template to use based on the event type
  const emailHtml = event === 'Escalated'
    ? emailService.templates.incidentEscalated(incident)
    : event === 'Resolved'
    ? emailService.templates.incidentResolved(incident)
    : event === 'Assigned'
    ? emailService.templates.incidentAssigned(incident, incident.assignedTo)
    : emailService.templates.incidentCreated(incident);

  // Auto-send RCA report when incident is resolved (all stakeholders)
  if (event === 'Resolved') {
    const rcaHtml    = emailService.templates.rcaReport(incident);
    const rcaSubject = emailService.buildRCASubject(incident);
    const rcaTargets = [
      incident.assignedTo?.email,
      incident.createdBy?.email,
    ].filter((e, i, arr) => e && arr.indexOf(e) === i);     // deduplicate

    for (const rcaTo of rcaTargets) {
      sendEmail(rcaTo, rcaSubject, rcaHtml).catch(() => {});
    }
    logger.info(`[notificationService] RCA report queued for ${incident.number} → [${rcaTargets.join(', ')}]`);
  }

  // Telegram alert (all priorities P1-P3, free & instant)
  const telegramText = buildTelegramAlert(incident, event);

  if (incident.priority === 'P1') {
    await sendTelegram(telegramText);
    await sendSlackMessage(null, slackText);
    if (incident.assignedTo?.email) await sendEmail(incident.assignedTo.email, title, emailHtml);
    if (incident.assignedTo?.phone) {
      const { hostname, ip } = emailService.buildIncidentSubject
        ? (() => {
            const desc = incident.description || '';
            const ci   = incident.configItem?.name || null;
            const h    = desc.match(/(?:node|host|server|device)[:\s]+([a-zA-Z0-9._-]{4,40})/i);
            const i2   = desc.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
            return { hostname: ci || h?.[1] || '', ip: i2?.[1] || '' };
          })()
        : { hostname: '', ip: '' };
      const smsBody = [
        `WeCrew ITSM Alert`,
        `${incident.number} | ${incident.priority} | ${event}`,
        `Org: ${incident.organization?.name || 'N/A'}`,
        hostname ? `Host: ${hostname}${ip ? ' (' + ip + ')' : ''}` : null,
        `Issue: ${incident.shortDescription}`,
        `Impact: ${incident.impact} | Urgency: ${incident.urgency}`,
        `Category: ${incident.category || 'N/A'}`,
        incident.assignedTo ? `Assigned: ${incident.assignedTo.firstName} ${incident.assignedTo.lastName}` : null,
        `Action Required: Acknowledge or Escalate`,
      ].filter(Boolean).join('\n');
      await sendSMS(incident.assignedTo.phone, smsBody, incident.id);
      await sendVoiceAlert(incident, incident.assignedTo.phone);
    }
  } else if (incident.priority === 'P2') {
    await sendTelegram(telegramText);
    await sendSlackMessage(null, slackText);
    if (incident.assignedTo?.email) await sendEmail(incident.assignedTo.email, title, emailHtml);
  } else if (incident.priority === 'P3') {
    await sendTelegram(telegramText);
    await sendSlackMessage(null, slackText);
  }
  // P4: WebSocket only (already handled above)
}

module.exports = { createNotification, sendEmail, sendSlackMessage, sendSMS, sendTelegram, sendVoiceAlert, notifyIncidentStakeholders };
