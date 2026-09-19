// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Email Service
// Templates + Queue + Nodemailer (no external template engine)
// ═══════════════════════════════════════════════════════════

const nodemailer = require('nodemailer');
const { incidentSubject } = require('../utils/incidentTitle');
const { prisma } = require('../config/database');
const { config } = require('../config/env');
const logger = require('../utils/logger');

// ── Nodemailer singleton ─────────────────────────────────

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!config.smtp.user) return null;
  _transporter = nodemailer.createTransport({
    host:       config.smtp.host,
    port:       config.smtp.port,
    secure:     config.smtp.port === 465,
    requireTLS: config.smtp.port === 587,   // Office365 / STARTTLS
    auth:       { user: config.smtp.user, pass: config.smtp.pass },
    tls:        { ciphers: 'SSLv3' },
  });
  return _transporter;
}

// ── Design tokens ────────────────────────────────────────

const PRIORITY_COLOR = { P1: '#DC2626', P2: '#D97706', P3: '#2563EB', P4: '#059669' };
const PRIORITY_LABEL = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' };
const PRIORITY_BG    = { P1: '#FEF2F2', P2: '#FFFBEB', P3: '#EFF6FF', P4: '#F0FDF4' };
const STATE_COLOR    = { NEW: '#2563EB', IN_PROGRESS: '#7C3AED', ON_HOLD: '#D97706',
                          ESCALATED: '#DC2626', RESOLVED: '#059669', CLOSED: '#6B7280' };
const IST_FMT = { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: true };

// ── Structured description renderer ──────────────────────
// Handles two formats produced by WeCrew:
//   Format A — Sections with "── Title ───" dividers + "Key: Value" pairs (alertSyncService)
//   Format B — Sections with "Title:" headers + bullet "•" lists (agentPipeline)
// Falls back to pre-formatted text if neither matches.

function renderAlertDescription(text, accentColor) {
  if (!text || text.trim().length < 10) return '';
  const ac = accentColor || '#2563EB';

  // ── Detect Format A: contains ── dividers ────────────────
  if (text.includes('──')) {
    const sectionRegex = /──+\s*([^─\n]+?)\s*──+/g;
    const sectionMatches = [...text.matchAll(/──+\s*([^─\n]+?)\s*──+/g)];
    if (sectionMatches.length > 0) {
      const parts = [];

      // Header block (before first ── marker)
      const headerText = text.substring(0, sectionMatches[0].index).trim();
      if (headerText) parts.push({ title: null, body: headerText });

      // Each section
      sectionMatches.forEach((m, i) => {
        const start = m.index + m[0].length;
        const end   = i + 1 < sectionMatches.length ? sectionMatches[i + 1].index : text.length;
        parts.push({ title: m[1].trim(), body: text.substring(start, end).trim() });
      });

      return parts.map(part => {
        const rows = parseKVLines(part.body);
        return `
        ${part.title ? `<p style="margin:16px 0 6px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.8px;">${part.title}</p>` : ''}
        ${rows.length > 0
          ? `<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:4px;">
              ${rows.map(([k, v], i) => `
              <tr style="background:${i % 2 === 0 ? '#F9FAFB' : '#FFFFFF'};">
                <td style="padding:8px 14px;color:#6B7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap;width:130px;border-bottom:1px solid #F3F4F6;vertical-align:top;">${k}</td>
                <td style="padding:8px 14px;color:#111827;font-size:13px;font-weight:500;border-bottom:1px solid #F3F4F6;">${v}</td>
              </tr>`).join('')}
            </table>`
          : `<p style="margin:0 0 8px;color:#374151;font-size:13px;line-height:1.8;white-space:pre-wrap;">${part.body}</p>`
        }`;
      }).join('');
    }
  }

  // ── Detect Format B: "Title:\n• bullet" structure ────────
  if (text.includes('\n') && (text.includes('•') || text.match(/\n[A-Z][A-Za-z ]+:\s*\n/))) {
    const lines  = text.split('\n');
    const blocks = [];
    let current  = null;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      // Section header: "Some Title:" alone on a line (no value after colon)
      if (/^[A-Z][A-Za-z ]{2,40}:$/.test(line)) {
        if (current) blocks.push(current);
        current = { title: line.replace(/:$/, ''), items: [], kvRows: [] };
      } else if (line.startsWith('•') || line.startsWith('-')) {
        if (!current) current = { title: null, items: [], kvRows: [] };
        current.items.push(line.replace(/^[•\-]\s*/, ''));
      } else {
        // Could be "Key: Value" inline
        const kv = line.match(/^([A-Za-z][A-Za-z0-9 \/\(\)_\-.]{1,30}?):\s+(.+)$/);
        if (kv) {
          if (!current) current = { title: null, items: [], kvRows: [] };
          current.kvRows.push([kv[1].trim(), kv[2].trim()]);
        } else {
          if (!current) current = { title: null, items: [], kvRows: [] };
          current.items.push(line);
        }
      }
    }
    if (current) blocks.push(current);

    if (blocks.length > 0) {
      return blocks.map(block => `
        ${block.title ? `<p style="margin:16px 0 6px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.8px;">${block.title}</p>` : ''}
        ${block.kvRows.length > 0
          ? `<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:8px;">
              ${block.kvRows.map(([k, v], i) => `
              <tr style="background:${i % 2 === 0 ? '#F9FAFB' : '#FFFFFF'};">
                <td style="padding:8px 14px;color:#6B7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap;width:140px;border-bottom:1px solid #F3F4F6;vertical-align:top;">${k}</td>
                <td style="padding:8px 14px;color:#111827;font-size:13px;border-bottom:1px solid #F3F4F6;">${v}</td>
              </tr>`).join('')}
            </table>`
          : ''}
        ${block.items.length > 0
          ? `<ul style="margin:0 0 8px;padding-left:20px;">
              ${block.items.map(item => `<li style="color:#374151;font-size:13px;line-height:1.9;margin-bottom:2px;">${item}</li>`).join('')}
            </ul>`
          : ''}
      `).join('');
    }
  }

  // ── Fallback: preserve newlines as <br/> ─────────────────
  const escaped = text
    .substring(0, 800)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `<p style="margin:0;color:#374151;font-size:13px;line-height:1.9;">${escaped}${text.length > 800 ? '…' : ''}</p>`;
}

function parseKVLines(text) {
  if (!text) return [];
  const rows = [];
  // Try newline-separated key: value
  const lines = text.split(/\n|\r\n?/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9 \/\(\)_\-.]{1,40}?):\s+(.+)$/);
    if (m) rows.push([m[1].trim(), m[2].trim()]);
  }
  if (rows.length > 0) return rows;

  // Single-line fallback — known keys from WeCrew alert format
  const KEYS = ['ALERT','Severity','Category','Client','Hostname','IP Address','Asset Type','Operating System','Job','Fired At','Duration','Instance','Value','Summary','Description','Host','State','Environment'];
  const escaped = KEYS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')}):\\s*([^]*?)(?=(?:${escaped.join('|')}):|$)`, 'g');
  for (const m of text.matchAll(pattern)) {
    const val = m[2].trim();
    if (val) rows.push([m[1].trim(), val]);
  }
  return rows;
}

// ── Shared host extractor & subject builder ───────────────

/**
 * Extract hostname + IP from incident description/configItem.
 * Used by every template and subject builder.
 */
function getHostInfo(incident) {
  const desc    = incident.description || '';
  const ciName  = incident.configItem?.name || null;
  const hostMatch = desc.match(/(?:node|host|server|device)[:\s]+([a-zA-Z0-9._-]{4,40})/i);
  const ipMatch   = desc.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
  return {
    hostname: ciName || hostMatch?.[1] || null,
    ip:       ipMatch?.[1] || null,
  };
}

/**
 * Build a rich, descriptive email subject that includes:
 *   [TAG][PRIORITY] OrgName · hostname (IP) · short description
 * Used by notificationService for every incident email.
 */
// Subject format lives in utils/incidentTitle (shared with chat/voice notifications).
function buildIncidentSubject(incident, event) {
  return incidentSubject(incident, event);
}

// ── Base layout — white card, accent hero bar ─────────────

function baseLayout(title, accentColor, tagline, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td align="center" style="padding:28px 12px;">
<table width="620" cellpadding="0" cellspacing="0" role="presentation" style="max-width:620px;width:100%;">

  <!-- Brand bar -->
  <tr><td style="padding:0 0 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td><span style="color:#111827;font-size:14px;font-weight:800;">WeCrew</span><span style="color:${accentColor};font-size:14px;font-weight:800;"> ITSM</span></td>
        <td align="right"><span style="color:#9CA3AF;font-size:11px;">${tagline}</span></td>
      </tr>
    </table>
  </td></tr>

  <!-- Accent hero bar -->
  <tr><td style="background:${accentColor};height:5px;border-radius:6px 6px 0 0;"></td></tr>

  <!-- Body card -->
  <tr><td style="background:#FFFFFF;padding:28px;border:1px solid #E5E7EB;border-top:none;">
    ${body}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#F9FAFB;padding:16px 28px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 10px 10px;">
    <p style="margin:0;color:#9CA3AF;font-size:11px;line-height:1.9;text-align:center;">
      Regards, <strong style="color:#6B7280;">WeCrew ITSM</strong><br/>
      WeCrew Technologies.<br/>
      No.55B, First Main, Electronic City Phase – 1, Bengaluru – 560 100 &nbsp;·&nbsp; Contact: 9176772077
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// ── Shared fragments ──────────────────────────────────────

function priorityBadge(incident) {
  const pc = PRIORITY_COLOR[incident.priority] || '#6B7280';
  const sc = STATE_COLOR[incident.state] || '#6B7280';
  const pl = PRIORITY_LABEL[incident.priority] || incident.priority;
  return `
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:16px;">
    <tr>
      <td style="background:${pc};color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">${incident.priority} · ${pl}</td>
      <td style="width:8px;"></td>
      <td style="background:${sc}18;border:1px solid ${sc}44;color:${sc};font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">${(incident.state||'').replace(/_/g,' ')}</td>
      <td style="width:8px;"></td>
      <td style="background:#F3F4F6;color:#374151;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;font-family:monospace;">${incident.number}</td>
    </tr>
  </table>`;
}

function kvRow(label, value, color) {
  if (!value && value !== 0) return '';
  return `<tr style="border-bottom:1px solid #F3F4F6;">
    <td style="padding:9px 16px 9px 0;color:#6B7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:9px 0;color:${color||'#111827'};font-size:13px;font-weight:500;">${value}</td>
  </tr>`;
}

function sectionLabel(text) {
  return `<p style="margin:20px 0 8px;font-size:12px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.8px;">${text}</p>`;
}

function divider() {
  return `<div style="border-top:1px solid #F3F4F6;margin:20px 0;"></div>`;
}

function ctaRow(buttons) {
  // buttons: [{ label, url, color, outlined? }]
  return `
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;">
    <tr>
      ${buttons.map((b, i) => `
      <td${i > 0 ? ' style="padding-left:10px;"' : ''}>
        <a href="${b.url}" style="display:inline-block;background:${b.outlined ? '#fff' : b.color};border:${b.outlined ? '1.5px solid #D1D5DB' : 'none'};color:${b.outlined ? '#374151' : '#fff'};font-size:13px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;letter-spacing:0.2px;">${b.label}</a>
      </td>`).join('')}
    </tr>
  </table>`;
}

function incidentDetailsBlock(incident) {
  const created   = incident.createdAt ? new Date(incident.createdAt).toLocaleString('en-IN', IST_FMT) : 'N/A';
  const slaTarget = incident.slaTargetResolution ? new Date(incident.slaTargetResolution).toLocaleString('en-IN', IST_FMT) : 'N/A';
  const assignee  = incident.assignedTo
    ? `${incident.assignedTo.firstName} ${incident.assignedTo.lastName}`
    : 'Unassigned';
  const { hostname, ip } = getHostInfo(incident);
  const hostLabel = [hostname, ip ? `(${ip})` : null].filter(Boolean).join(' ');
  return `
  ${sectionLabel('Incident Details')}
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
    ${kvRow('Incident #',   incident.number, '#4F46E5')}
    ${kvRow('Organization', incident.organization?.name)}
    ${hostLabel ? kvRow('Host / CI', hostLabel, '#111827') : (incident.configItem?.name ? kvRow('CI / Asset', incident.configItem.name) : '')}
    ${kvRow('Category',     incident.category || 'Uncategorized')}
    ${kvRow('Impact',       incident.impact)}
    ${kvRow('Urgency',      incident.urgency)}
    ${kvRow('Source',       incident.source)}
    ${kvRow('Assigned To',  assignee)}
    ${kvRow('Team',         incident.assignmentGroup?.name)}
    ${kvRow('Created',      created + ' IST')}
    ${kvRow('SLA Target',   slaTarget + ' IST')}
    ${incident.slaBreached ? kvRow('SLA Status', 'Resolution target BREACHED', '#DC2626') : ''}
  </table>`;
}

// ── Template 1: Incident Created ─────────────────────────

function renderIncidentCreated(incident) {
  const url = `${config.frontendUrl}/incidents/${incident.id}`;
  const pc  = PRIORITY_COLOR[incident.priority] || '#2563EB';
  const pb  = PRIORITY_BG[incident.priority]    || '#EFF6FF';
  const { hostname, ip } = getHostInfo(incident);
  const hostLabel = [hostname, ip ? `(${ip})` : null].filter(Boolean).join(' ');
  const orgName   = incident.organization?.name || 'Unknown';
  const body = `
  <!-- Alert banner -->
  <div style="background:${pb};border-left:4px solid ${pc};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:20px;">
    <p style="margin:0;color:${pc};font-size:13px;font-weight:700;">New Incident Logged — Immediate review required</p>
  </div>

  ${priorityBadge(incident)}
  <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111827;line-height:1.3;">${incident.shortDescription}</h2>
  <p style="margin:0 0 16px;color:#6B7280;font-size:13px;">
    Organization: <strong style="color:#374151;">${orgName}</strong>
    ${hostLabel ? `&nbsp;·&nbsp; Host: <strong style="color:#374151;font-family:'Courier New',monospace;">${hostLabel}</strong>` : ''}
    &nbsp;·&nbsp; Source: ${incident.source || 'Manual'}
  </p>

  ${incident.description ? `
  <div style="background:#F9FAFB;border-left:3px solid ${pc};border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
    ${renderAlertDescription(incident.description, pc)}
  </div>` : ''}

  ${incidentDetailsBlock(incident)}
  ${ctaRow([
    { label: 'View Incident →', url, color: pc },
    { label: 'Open Dashboard', url: `${config.frontendUrl}/dashboard`, color: '#fff', outlined: true }
  ])}`;
  return baseLayout(`New Incident: ${incident.number}`, pc, 'Incident Management · WeCrew', body);
}

// ── Template 2: Incident Assigned ────────────────────────

function renderIncidentAssigned(incident, assignee) {
  const url  = `${config.frontendUrl}/incidents/${incident.id}`;
  const name = assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Team Member';
  const pc   = PRIORITY_COLOR[incident.priority] || '#7C3AED';
  const { hostname, ip } = getHostInfo(incident);
  const hostLabel = [hostname, ip ? `(${ip})` : null].filter(Boolean).join(' ');
  const orgName   = incident.organization?.name || 'Unknown';
  const body = `
  <!-- Personal greeting -->
  <div style="background:#FAF5FF;border-left:4px solid #7C3AED;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:20px;">
    <p style="margin:0;color:#7C3AED;font-size:13px;font-weight:700;">Hi ${name} — an incident has been assigned to you</p>
  </div>

  ${priorityBadge(incident)}
  <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111827;line-height:1.3;">${incident.shortDescription}</h2>
  <p style="margin:0 0 16px;color:#6B7280;font-size:13px;">
    Organization: <strong style="color:#374151;">${orgName}</strong>
    ${hostLabel ? `&nbsp;·&nbsp; Host: <strong style="color:#374151;font-family:'Courier New',monospace;">${hostLabel}</strong>` : ''}
    <br/>Please review and begin investigation immediately. Acknowledge to stop escalation.
  </p>

  ${incident.description ? `
  <div style="background:#F9FAFB;border-left:3px solid #7C3AED;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
    ${renderAlertDescription(incident.description, '#7C3AED')}
  </div>` : ''}

  ${incidentDetailsBlock(incident)}

  <!-- SLA countdown reminder -->
  <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px 16px;margin-top:16px;">
    <p style="margin:0;color:#92400E;font-size:12px;">⏱ <strong>SLA Resolution Target:</strong> ${incident.slaTargetResolution ? new Date(incident.slaTargetResolution).toLocaleString('en-IN', IST_FMT) + ' IST' : 'Not set'} — please resolve before this deadline.</p>
  </div>

  ${ctaRow([
    { label: '✓ Acknowledge & Start →', url, color: '#7C3AED' },
    { label: 'View All Incidents', url: `${config.frontendUrl}/incidents`, color: '#fff', outlined: true }
  ])}`;
  return baseLayout(`Assigned to You: ${incident.number}`, '#7C3AED', 'Incident Assignment · WeCrew', body);
}

// ── Template 3: Incident Escalated — Clean Light Theme ───────────────────────
// Modern white-background card design: red accent hero bar, stat pillars with
// progress bars, timeline with dot connectors, one-click acknowledge JWT link.

function renderIncidentEscalated(incident, opts = {}) {
  const jwt       = (() => { try { return require('jsonwebtoken'); } catch { return null; } })();
  const portalUrl = `${config.frontendUrl}/incidents/${incident.id}`;
  const level     = opts.escalationLevel || incident.escalationLevel || 1;
  const elapsed   = incident.createdAt
    ? (() => {
        const m = Math.round((Date.now() - new Date(incident.createdAt)) / 60000);
        if (m >= 1440) return `${Math.floor(m/1440)}d ${Math.floor((m%1440)/60)}h`;
        return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`;
      })()
    : 'Unknown';
  const created   = incident.createdAt
    ? new Date(incident.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
    : 'N/A';
  const slaBreached = !!incident.slaBreached;
  const orgName   = incident.organization?.name   || 'Unknown';
  const teamName  = incident.assignmentGroup?.name || 'Unassigned';
  const category  = incident.category || 'Infrastructure';

  // One-click acknowledge URL (24h signed JWT, no login needed)
  let ackUrl = portalUrl;
  if (jwt && process.env.JWT_SECRET) {
    try {
      const token = jwt.sign({ incidentId: incident.id, action: 'ack' }, process.env.JWT_SECRET, { expiresIn: '24h' });
      const base  = (process.env.API_URL || process.env.FRONTEND_URL || 'https://itsm.wecrew.in').replace(/\/$/, '');
      ackUrl = `${base}/api/v1/incidents/ack?token=${token}`;
    } catch (_) { /* fallback */ }
  }

  // ── Metric stat pillar (light) ─────────────────────────
  function statPillar(label, value, pct, isCritical) {
    const barColor = isCritical ? '#DC2626' : pct > 70 ? '#D97706' : '#16A34A';
    const bgColor  = isCritical ? '#FEF2F2' : pct > 70 ? '#FFFBEB' : '#F0FDF4';
    const bdrColor = isCritical ? '#FECACA' : pct > 70 ? '#FDE68A' : '#BBF7D0';
    const barW     = Math.min(100, Math.max(2, pct));
    return `
    <td style="padding:0 5px;width:25%;">
      <div style="background:${bgColor};border:1px solid ${bdrColor};border-radius:10px;padding:14px 10px;text-align:center;">
        <div style="color:${barColor};font-size:20px;font-weight:800;line-height:1;margin-bottom:3px;">${value}</div>
        <div style="color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">${label}</div>
        <div style="background:#E5E7EB;border-radius:3px;height:4px;overflow:hidden;">
          <div style="background:${barColor};height:4px;width:${barW}%;border-radius:3px;"></div>
        </div>
      </div>
    </td>`;
  }

  // Extract metric values from opts or incident description
  const m        = opts.metrics || [];
  const cpuEntry = m.find(x => /cpu/i.test(x.metric));
  const memEntry = m.find(x => /mem/i.test(x.metric));
  const cpuVal   = cpuEntry?.value || (incident.description?.match(/CPU[:\s]+([0-9.]+%)/i)?.[1]) || 'N/A';
  const memVal   = memEntry?.value || (incident.description?.match(/[Mm]em[^:]*[:\s]+([0-9.]+%)/)?.[1]) || 'N/A';
  const cpuPct   = parseFloat(cpuVal) || 0;
  const memPct   = parseFloat(memVal) || 0;

  const pillarsHtml = `
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin-top:16px;">
    <tr>
      ${statPillar('CPU', cpuVal, cpuPct, cpuPct > 85)}
      ${statPillar('Memory', memVal, memPct, memPct > 85)}
      <td style="padding:0 5px;width:25%;">
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:14px 10px;text-align:center;">
          <div style="color:#DC2626;font-size:20px;font-weight:800;line-height:1;margin-bottom:3px;">L${level}</div>
          <div style="color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Escalation</div>
          <div style="color:#DC2626;font-size:10px;font-weight:600;">${elapsed}</div>
        </div>
      </td>
      <td style="padding:0 5px;width:25%;">
        <div style="background:${slaBreached ? '#FEF2F2' : '#FFFBEB'};border:1px solid ${slaBreached ? '#FECACA' : '#FDE68A'};border-radius:10px;padding:14px 10px;text-align:center;">
          <div style="color:${slaBreached ? '#DC2626' : '#D97706'};font-size:14px;font-weight:800;line-height:1.2;margin-bottom:3px;">${slaBreached ? 'BREACHED' : 'AT RISK'}</div>
          <div style="color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">SLA</div>
        </div>
      </td>
    </tr>
  </table>`;

  // ── Metrics detail table ───────────────────────────────
  const extraMetrics = m.filter(x => !/^cpu$|^memory$|^mem$/i.test(x.metric));
  const metricsTableHtml = m.length > 0 ? `
  <p style="margin:20px 0 8px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.8px;">Live Infrastructure Metrics</p>
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-size:12px;">
    <thead>
      <tr style="background:#F9FAFB;">
        <th style="padding:8px 12px;text-align:left;color:#6B7280;font-weight:600;font-size:11px;border-bottom:1px solid #E5E7EB;">HOST / DEVICE</th>
        <th style="padding:8px 12px;text-align:left;color:#6B7280;font-weight:600;font-size:11px;border-bottom:1px solid #E5E7EB;">METRIC</th>
        <th style="padding:8px 12px;text-align:center;color:#6B7280;font-weight:600;font-size:11px;border-bottom:1px solid #E5E7EB;">VALUE</th>
        <th style="padding:8px 12px;text-align:center;color:#6B7280;font-weight:600;font-size:11px;border-bottom:1px solid #E5E7EB;">STATUS</th>
      </tr>
    </thead>
    <tbody>
      ${m.map((mx, i) => {
        const sc = mx.critical ? '#DC2626' : mx.warning ? '#D97706' : '#16A34A';
        const bg = mx.critical ? '#FEF2F2' : mx.warning ? '#FFFBEB' : (i%2===0 ? '#ffffff' : '#F9FAFB');
        const sl = mx.critical ? 'CRITICAL' : mx.warning ? 'WARNING' : 'OK';
        return `<tr style="background:${bg};">
          <td style="padding:8px 12px;color:#374151;font-family:'Courier New',monospace;font-size:11px;border-bottom:1px solid #F3F4F6;">${mx.host||'—'}</td>
          <td style="padding:8px 12px;color:#374151;border-bottom:1px solid #F3F4F6;">${mx.metric||'—'}</td>
          <td style="padding:8px 12px;text-align:center;font-weight:700;color:${sc};border-bottom:1px solid #F3F4F6;">${mx.value||'—'}</td>
          <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #F3F4F6;"><span style="background:${sc}18;border:1px solid ${sc}44;color:${sc};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">${sl}</span></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>` : '';

  // ── Timeline ───────────────────────────────────────────
  const timelineEvents = opts.timeline || [
    { time: created,   label: 'Incident created by WeCrew alert pipeline',      dot: '#3B82F6' },
    { time: 'Ongoing', label: `Auto-escalated to Level ${level}`,              dot: '#DC2626' },
    { time: 'SLA',     label: slaBreached ? 'SLA resolution target BREACHED'  : 'SLA resolution target AT RISK', dot: slaBreached ? '#DC2626' : '#D97706' },
    { time: 'Now',     label: 'Awaiting your acknowledgment',                  dot: '#D97706' },
  ];

  const timelineHtml = `
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
    ${timelineEvents.map((ev, i) => `
    <tr>
      <td style="width:108px;padding:6px 14px 6px 0;text-align:right;vertical-align:top;">
        <span style="color:#9CA3AF;font-size:11px;font-weight:600;font-family:'Courier New',monospace;white-space:nowrap;">${ev.time}</span>
      </td>
      <td style="width:22px;text-align:center;vertical-align:top;padding-top:3px;">
        <div style="width:12px;height:12px;border-radius:50%;background:${ev.dot};display:inline-block;border:2px solid #ffffff;box-shadow:0 0 0 2px ${ev.dot};"></div>
        ${i < timelineEvents.length-1 ? `<div style="width:2px;height:24px;background:#E5E7EB;margin:3px auto 0;"></div>` : ''}
      </td>
      <td style="padding:5px 0 5px 14px;vertical-align:top;">
        <span style="color:#111827;font-size:13px;font-weight:500;line-height:1.6;">${ev.label}</span>
      </td>
    </tr>`).join('')}
  </table>`;

  // ── Remediation commands ───────────────────────────────
  const cmds = opts.commands || [];
  const commandsHtml = cmds.length > 0 ? `
  <p style="margin:20px 0 8px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.8px;">Remediation Steps</p>
  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 16px;">
    ${cmds.map(c => `<p style="margin:0 0 6px;color:#1E3A5F;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.6;"><span style="color:#9CA3AF;">$</span> ${c}</p>`).join('')}
  </div>` : '';

  // ── Full light email layout ────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>[P1 ESCALATION L${level}] ${incident.number}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:28px 12px;">
      <table width="620" cellpadding="0" cellspacing="0" role="presentation" style="max-width:620px;width:100%;">

        <!-- ── BRAND BAR ── -->
        <tr><td style="padding:0 0 10px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td><span style="color:#111827;font-size:15px;font-weight:800;letter-spacing:-0.3px;">WeCrew</span><span style="color:#DC2626;font-size:15px;font-weight:800;"> ITSM</span></td>
              <td align="right"><span style="color:#9CA3AF;font-size:11px;">Automated Escalation · WeCrew Platform</span></td>
            </tr>
          </table>
        </td></tr>

        <!-- ── RED ACCENT HERO ── -->
        <tr><td style="background:#DC2626;border-radius:12px 12px 0 0;padding:24px 28px 20px;">
          <!-- Escalation badge -->
          <div style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:4px 14px;margin-bottom:14px;">
            <span style="color:#fff;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">🚨 ESCALATION LEVEL ${level} · UNRESOLVED ${elapsed}</span>
          </div>
          <!-- Number + title -->
          <p style="margin:0 0 6px;color:rgba(255,255,255,0.75);font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">${incident.priority} Critical &nbsp;·&nbsp; ${incident.number}</p>
          <h1 style="margin:0 0 10px;color:#FFFFFF;font-size:20px;font-weight:800;line-height:1.35;">${incident.shortDescription}</h1>
          <!-- Org · Team · Category chips -->
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding-right:8px;"><span style="background:rgba(255,255,255,0.18);color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;">${orgName}</span></td>
              <td style="padding-right:8px;"><span style="background:rgba(255,255,255,0.18);color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;">${teamName}</span></td>
              <td><span style="background:rgba(255,255,255,0.18);color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;">${category}</span></td>
            </tr>
          </table>
        </td></tr>

        <!-- ── STAT PILLARS (below hero, white bg) ── -->
        <tr><td style="background:#ffffff;border:1px solid #E5E7EB;border-top:none;padding:20px 28px 0;">
          ${pillarsHtml}
        </td></tr>

        <!-- ── BODY ── -->
        <tr><td style="background:#ffffff;border:1px solid #E5E7EB;border-top:none;padding:20px 28px 28px;">

          <!-- Description (structured) -->
          ${incident.description ? `
          <div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
            ${renderAlertDescription(incident.description, '#DC2626')}
          </div>` : ''}

          <!-- Metrics table -->
          ${metricsTableHtml}

          <!-- Commands -->
          ${commandsHtml}

          <!-- Timeline -->
          <p style="margin:20px 0 12px;font-size:12px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.8px;">Incident Timeline</p>
          ${timelineHtml}

          <!-- Details table -->
          <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin-top:20px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
            ${[
              ['Organization',  orgName,                                                    '#374151'],
              ['Priority',      `${incident.priority} — Critical`,                          '#DC2626'],
              ['State',         (incident.state||'').replace('_',' '),                      '#374151'],
              ['SLA Status',    slaBreached ? 'Resolution target BREACHED' : 'AT RISK',     slaBreached ? '#DC2626' : '#D97706'],
              ['Team',          teamName,                                                   '#374151'],
              ['Created',       `${created} IST`,                                           '#374151'],
            ].map(([label, value, color], i) => `
            <tr style="background:${i%2===0?'#F9FAFB':'#ffffff'};">
              <td style="padding:10px 14px;color:#6B7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;width:140px;border-bottom:1px solid #F3F4F6;">${label}</td>
              <td style="padding:10px 14px;color:${color};font-size:13px;font-weight:600;border-bottom:1px solid #F3F4F6;">${value}</td>
            </tr>`).join('')}
          </table>

          <!-- Required action box -->
          <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:14px 16px;margin-top:20px;">
            <p style="margin:0 0 6px;color:#92400E;font-size:12px;font-weight:700;">⚡ Required Action</p>
            <p style="margin:0;color:#78350F;font-size:12px;line-height:1.7;">
              Investigate and resolve this incident <strong>immediately</strong>.<br/>
              Click <strong>Acknowledge Now</strong> to stop further escalation and mark as In Progress — <em>no login required.</em>
            </p>
          </div>

          <!-- CTA Buttons -->
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:22px;width:100%;">
            <tr>
              <td style="padding-right:8px;width:50%;">
                <a href="${ackUrl}" style="display:block;background:#DC2626;color:#ffffff;font-size:14px;font-weight:800;padding:14px 0;border-radius:8px;text-decoration:none;text-align:center;letter-spacing:0.3px;">✓ Acknowledge Now</a>
              </td>
              <td style="padding-left:8px;width:50%;">
                <a href="${portalUrl}" style="display:block;background:#ffffff;border:1.5px solid #D1D5DB;color:#374151;font-size:14px;font-weight:700;padding:14px 0;border-radius:8px;text-decoration:none;text-align:center;">View in WeCrew →</a>
              </td>
            </tr>
          </table>
          <p style="margin:10px 0 0;color:#9CA3AF;font-size:10px;text-align:center;">Acknowledging stops escalation and transitions this incident to <em>In Progress</em>.</p>

        </td></tr>

        <!-- ── FOOTER ── -->
        <tr><td style="background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:16px 28px;">
          <p style="margin:0;color:#9CA3AF;font-size:11px;line-height:1.9;text-align:center;">
            Regards, <strong style="color:#6B7280;">WeCrew ITSM</strong><br/>
            WeCrew Technologies.<br/>
            No.55B, First Main, Electronic City Phase – 1, Bengaluru – 560 100 &nbsp;·&nbsp; Contact: 9176772077
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Template 4: Incident Resolved ────────────────────────

function renderIncidentResolved(incident) {
  const url      = `${config.frontendUrl}/incidents/${incident.id}`;
  const resolved = incident.resolvedAt
    ? new Date(incident.resolvedAt).toLocaleString('en-IN', IST_FMT) + ' IST'
    : 'N/A';
  const duration = incident.createdAt && incident.resolvedAt
    ? Math.round((new Date(incident.resolvedAt) - new Date(incident.createdAt)) / 60000)
    : null;
  const durationStr = duration
    ? (duration < 60 ? `${duration} min` : `${Math.floor(duration / 60)}h ${duration % 60}m`)
    : null;
  const orgName = incident.organization?.name || 'Unknown';

  const body = `
  <!-- Success banner -->
  <div style="background:#F0FDF4;border-left:4px solid #059669;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
    <p style="margin:0;color:#059669;font-size:13px;font-weight:700;">Incident closed — thank you for the swift resolution.</p>
  </div>

  ${priorityBadge(incident)}
  <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111827;line-height:1.3;">${incident.shortDescription}</h2>
  <p style="margin:0 0 16px;color:#6B7280;font-size:13px;">Organization: <strong style="color:#374151;">${orgName}</strong></p>

  ${sectionLabel('Resolution Summary')}
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
    ${kvRow('Resolved At',     resolved)}
    ${durationStr ? kvRow('Time to Resolve', durationStr, '#059669') : ''}
    ${kvRow('Resolution Code', incident.resolutionCode)}
    ${incident.resolutionNotes ? kvRow('Resolution Notes', incident.resolutionNotes.substring(0, 200)) : ''}
  </table>

  ${divider()}
  ${incidentDetailsBlock(incident)}
  ${ctaRow([
    { label: 'View Resolution Details →', url, color: '#059669' },
    { label: 'Open Dashboard', url: `${config.frontendUrl}/dashboard`, color: '#fff', outlined: true }
  ])}`;

  return baseLayout(`Resolved: ${incident.number}`, '#059669', 'Incident Resolved · WeCrew', body);
}

// ── Template 5: SLA Warning ──────────────────────────────

function renderSLAWarning(incident, remainingMinutes) {
  const url     = `${config.frontendUrl}/incidents/${incident.id}`;
  const hours   = Math.floor(remainingMinutes / 60);
  const mins    = remainingMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const orgName = incident.organization?.name || 'Unknown';

  const body = `
  <!-- Warning banner -->
  <div style="background:#FFFBEB;border-left:4px solid #D97706;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
    <p style="margin:0 0 4px;color:#92400E;font-size:13px;font-weight:700;">SLA breach in <strong>${timeStr}</strong> — resolve this incident immediately.</p>
    <p style="margin:0;color:#78350F;font-size:12px;">Resolution window is closing. Failure to resolve will trigger SLA breach and automatic escalation.</p>
  </div>

  ${priorityBadge(incident)}
  <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111827;line-height:1.3;">${incident.shortDescription}</h2>
  <p style="margin:0 0 16px;color:#6B7280;font-size:13px;">Organization: <strong style="color:#374151;">${orgName}</strong></p>

  ${incidentDetailsBlock(incident)}

  <!-- SLA countdown box -->
  <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin-top:16px;text-align:center;">
    <p style="margin:0 0 4px;color:#92400E;font-size:24px;font-weight:800;">${timeStr}</p>
    <p style="margin:0;color:#78350F;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Remaining until SLA breach</p>
  </div>

  ${ctaRow([
    { label: 'Resolve Now →', url, color: '#D97706' },
    { label: 'View Incidents', url: `${config.frontendUrl}/incidents`, color: '#fff', outlined: true }
  ])}`;

  return baseLayout(`SLA Warning: ${incident.number}`, '#D97706', 'SLA Alert · WeCrew', body);
}

// ── Template 6: SLA Breached ─────────────────────────────

function renderSLABreached(incident) {
  const url     = `${config.frontendUrl}/incidents/${incident.id}`;
  const orgName = incident.organization?.name || 'Unknown';
  const elapsed = incident.createdAt
    ? (() => {
        const m = Math.round((Date.now() - new Date(incident.createdAt)) / 60000);
        return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`;
      })()
    : 'Unknown';

  const body = `
  <!-- Breach banner -->
  <div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
    <p style="margin:0 0 4px;color:#DC2626;font-size:13px;font-weight:700;">SLA BREACHED — This incident has exceeded its resolution target.</p>
    <p style="margin:0;color:#7F1D1D;font-size:12px;">Immediate escalation and resolution required. Management has been notified.</p>
  </div>

  ${priorityBadge(incident)}
  <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111827;line-height:1.3;">${incident.shortDescription}</h2>
  <p style="margin:0 0 16px;color:#6B7280;font-size:13px;">Organization: <strong style="color:#374151;">${orgName}</strong> &nbsp;·&nbsp; Open for <strong style="color:#DC2626;">${elapsed}</strong></p>

  ${incidentDetailsBlock(incident)}

  <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:16px;margin-top:16px;">
    <p style="margin:0 0 8px;color:#DC2626;font-size:12px;font-weight:700;">Required actions:</p>
    <ul style="margin:0;padding-left:18px;color:#374151;font-size:12px;line-height:2;">
      <li>Immediately take ownership and begin active investigation</li>
      <li>Provide an update in WeCrew with current status and ETA</li>
      <li>If blocked, escalate to your manager or team lead</li>
    </ul>
  </div>

  ${ctaRow([
    { label: 'Resolve Immediately →', url, color: '#DC2626' },
    { label: 'View All Breaches', url: `${config.frontendUrl}/incidents?slaBreached=true`, color: '#fff', outlined: true }
  ])}`;

  return baseLayout(`SLA BREACHED: ${incident.number}`, '#DC2626', 'SLA Breach Alert · WeCrew', body);
}

// ── Template 7: Change Approval Request ──────────────────

function renderChangeApprovalRequest(change, approver) {
  const url      = `${config.frontendUrl}/changes/${change.id}`;
  const planDate = change.plannedStartDate
    ? new Date(change.plannedStartDate).toLocaleString('en-IN', IST_FMT) + ' IST'
    : 'TBD';
  const requester = change.createdBy
    ? `${change.createdBy.firstName} ${change.createdBy.lastName}`
    : 'System';
  const approverName = approver ? `${approver.firstName} ${approver.lastName}` : 'Approver';

  const riskColor = { LOW: '#059669', MEDIUM: '#D97706', HIGH: '#DC2626', CRITICAL: '#DC2626' };
  const rc = riskColor[change.riskLevel] || '#6B7280';

  const body = `
  <!-- Greeting banner -->
  <div style="background:#FAF5FF;border-left:4px solid #7C3AED;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
    <p style="margin:0;color:#7C3AED;font-size:13px;font-weight:700;">Hi ${approverName} — your approval is required for a change request.</p>
  </div>

  <!-- Change number badge -->
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:16px;">
    <tr>
      <td style="background:#7C3AED;color:#fff;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;font-family:monospace;">${change.number}</td>
      <td style="width:8px;"></td>
      <td style="background:${rc}18;border:1px solid ${rc}44;color:${rc};font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">${change.riskLevel || 'MEDIUM'} RISK</td>
      <td style="width:8px;"></td>
      <td style="background:#F3F4F6;color:#374151;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;">${change.type || 'STANDARD'}</td>
    </tr>
  </table>

  <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111827;line-height:1.3;">${change.shortDescription}</h2>
  <p style="margin:0 0 16px;color:#6B7280;font-size:13px;">
    ${change.organization?.name ? `Organization: <strong style="color:#374151;">${change.organization.name}</strong> &nbsp;·&nbsp; ` : ''}Requested by: <strong style="color:#374151;">${requester}</strong>
  </p>

  ${change.justification ? `
  <div style="background:#F9FAFB;border-left:3px solid #7C3AED;border-radius:0 6px 6px 0;padding:12px 16px;margin-bottom:20px;">
    <p style="margin:0 0 4px;color:#7C3AED;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Justification</p>
    <p style="margin:0;color:#374151;font-size:12px;line-height:1.8;">${change.justification.substring(0, 300)}</p>
  </div>` : ''}

  ${sectionLabel('Change Details')}
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
    ${kvRow('Change Number', change.number, '#7C3AED')}
    ${kvRow('Type',          change.type)}
    ${kvRow('Risk Level',    change.riskLevel, rc)}
    ${kvRow('Category',      change.category)}
    ${kvRow('Planned Start', planDate)}
    ${kvRow('Downtime',      change.downtime ? `${change.downtime} min` : 'None')}
    ${kvRow('Requested By',  requester)}
  </table>

  <!-- Approve / Reject buttons -->
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;width:100%;">
    <tr>
      <td style="padding-right:6px;width:33%;">
        <a href="${url}?action=approve" style="display:block;background:#059669;color:#fff;font-size:13px;font-weight:700;padding:13px 0;border-radius:8px;text-decoration:none;text-align:center;">✓ Approve</a>
      </td>
      <td style="padding:0 6px;width:33%;">
        <a href="${url}?action=reject" style="display:block;background:#DC2626;color:#fff;font-size:13px;font-weight:700;padding:13px 0;border-radius:8px;text-decoration:none;text-align:center;">✗ Reject</a>
      </td>
      <td style="padding-left:6px;width:33%;">
        <a href="${url}" style="display:block;background:#fff;border:1.5px solid #D1D5DB;color:#374151;font-size:13px;font-weight:700;padding:13px 0;border-radius:8px;text-decoration:none;text-align:center;">View Details</a>
      </td>
    </tr>
  </table>
  <p style="margin:10px 0 0;color:#9CA3AF;font-size:10px;text-align:center;">Approve or Reject directly from this email — or view full details in WeCrew before deciding.</p>`;

  return baseLayout(`Approval Required: ${change.number}`, '#7C3AED', 'Change Management · WeCrew', body);
}

// ── Template 8: Daily Digest ─────────────────────────────

function renderDailyDigest(stats) {
  const url  = `${config.frontendUrl}/dashboard`;
  const date = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });

  const statCard = (label, value, color) => `
    <td style="padding:4px;">
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px 12px;text-align:center;border-top:3px solid ${color};">
        <div style="font-size:28px;font-weight:800;color:${color};line-height:1;">${value}</div>
        <div style="margin-top:6px;font-size:11px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">${label}</div>
      </div>
    </td>`;

  const body = `
  <!-- Date header -->
  <div style="margin-bottom:20px;">
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#111827;">Daily Operations Digest</h2>
    <p style="margin:0;color:#6B7280;font-size:13px;">${stats.orgName ? `<strong style="color:#374151;">${stats.orgName}</strong> &nbsp;·&nbsp; ` : ''}${date}</p>
  </div>

  ${sectionLabel('Today\'s Snapshot')}
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      ${statCard('Open Incidents',  stats.openIncidents  ?? 0,   '#2563EB')}
      ${statCard('P1 Active',       stats.p1Active       ?? 0,   '#DC2626')}
      ${statCard('SLA Breaches',    stats.slaBreached    ?? 0,   '#D97706')}
      ${statCard('Resolved Today',  stats.resolvedToday  ?? 0,   '#059669')}
    </tr>
  </table>
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin-top:0;">
    <tr>
      ${statCard('Changes Pending', stats.changesPending ?? 0,   '#7C3AED')}
      ${statCard('Alerts Firing',   stats.alertsFiring  ?? 0,   '#DC2626')}
      ${statCard('SLA Compliance',  `${stats.slaCompliance ?? 100}%`, '#059669')}
      ${statCard('MTTR',            stats.mttrMinutes != null ? `${stats.mttrMinutes}m` : 'N/A', '#0891B2')}
    </tr>
  </table>

  ${stats.topIncidents && stats.topIncidents.length > 0 ? `
  ${divider()}
  ${sectionLabel('Open Critical Incidents')}
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
    <thead>
      <tr style="background:#F9FAFB;">
        <th style="padding:9px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">NUMBER</th>
        <th style="padding:9px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">DESCRIPTION</th>
        <th style="padding:9px 12px;text-align:center;font-size:11px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">PRIORITY</th>
      </tr>
    </thead>
    <tbody>
      ${stats.topIncidents.map((inc, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#F9FAFB'};">
        <td style="padding:8px 12px;font-size:12px;font-family:'Courier New',monospace;color:#2563EB;font-weight:600;border-bottom:1px solid #F3F4F6;">${inc.number}</td>
        <td style="padding:8px 12px;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;">${(inc.shortDescription || '').substring(0, 50)}</td>
        <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #F3F4F6;"><span style="background:${PRIORITY_COLOR[inc.priority] || '#6B7280'};color:#fff;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;">${inc.priority}</span></td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${ctaRow([
    { label: 'Open Dashboard →', url, color: '#2563EB' },
    { label: 'View Incidents', url: `${config.frontendUrl}/incidents`, color: '#fff', outlined: true }
  ])}`;

  const digestTitle = stats.orgName ? `Daily Digest — ${stats.orgName}` : 'Daily Operations Digest';
  return baseLayout(digestTitle, '#2563EB', 'Daily Report · WeCrew', body);
}

// ── Template 9: P1 Alert Notification (with real metrics) ─

function renderAlertNotification(data) {
  // data: { orgName, alerts: [{ name, host, status, value, threshold, unit, age, volumes }] }
  const url         = `${config.frontendUrl}/alerts`;
  const now         = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const totalAlerts = data.alerts?.length || 0;

  const diskVolumeTable = (volumes) => {
    if (!volumes || !volumes.length) return '';
    return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11px;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;">
      <tr style="background:#F9FAFB;">
        <th style="padding:6px 10px;text-align:left;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">VOLUME</th>
        <th style="padding:6px 10px;text-align:right;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">USED</th>
        <th style="padding:6px 10px;text-align:right;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">FREE</th>
        <th style="padding:6px 10px;text-align:right;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">TOTAL</th>
        <th style="padding:6px 10px;text-align:center;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">USE%</th>
      </tr>
      ${volumes.map(v => {
        const pct = v.total > 0 ? Math.round(((v.total - v.free) / v.total) * 100) : 0;
        const bc  = pct >= 90 ? '#DC2626' : pct >= 80 ? '#D97706' : '#059669';
        return `<tr style="border-bottom:1px solid #F3F4F6;">
          <td style="padding:7px 10px;font-weight:600;color:#374151;">${v.volume}</td>
          <td style="padding:7px 10px;text-align:right;color:#374151;">${v.used.toFixed(1)} GB</td>
          <td style="padding:7px 10px;text-align:right;color:#059669;">${v.free.toFixed(1)} GB</td>
          <td style="padding:7px 10px;text-align:right;color:#374151;">${v.total.toFixed(1)} GB</td>
          <td style="padding:7px 10px;text-align:center;">
            <div style="background:#E5E7EB;border-radius:4px;height:8px;width:70px;display:inline-block;vertical-align:middle;">
              <div style="background:${bc};border-radius:4px;height:8px;width:${Math.min(pct, 100) * 0.7}px;"></div>
            </div>
            <span style="margin-left:6px;font-weight:700;color:${bc};">${pct}%</span>
          </td>
        </tr>`;
      }).join('')}
    </table>`;
  };

  const alertCards = (data.alerts || []).map((a) => {
    const ageStr      = a.age >= 60 ? `${Math.floor(a.age/60)}h ${a.age%60}m` : `${a.age}m`;
    const statusColor = a.status === 'CRITICAL' ? '#DC2626' : '#D97706';
    return `
    <div style="border:1px solid #FCA5A5;border-radius:10px;padding:16px;margin-bottom:12px;background:#FFFFFF;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td><span style="font-size:13px;font-weight:700;color:#111827;">${a.name}</span>
            <span style="margin-left:8px;background:${statusColor};color:#fff;font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;">${a.status}</span>
          </td>
          <td align="right" style="color:#9CA3AF;font-size:11px;">Firing for <strong>${ageStr}</strong></td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin-top:10px;">
        <tr>
          <td style="padding:4px 0;color:#6B7280;font-size:12px;width:120px;">Host / Device</td>
          <td style="padding:4px 0;color:#111827;font-size:12px;font-weight:600;font-family:'Courier New',monospace;">${a.host || '—'}</td>
        </tr>
        ${a.value ? `<tr>
          <td style="padding:4px 0;color:#6B7280;font-size:12px;">Current Value</td>
          <td style="padding:4px 0;color:#DC2626;font-size:13px;font-weight:700;">${a.value}${a.unit || ''}</td>
        </tr>` : ''}
        ${a.threshold ? `<tr>
          <td style="padding:4px 0;color:#6B7280;font-size:12px;">Threshold</td>
          <td style="padding:4px 0;color:#374151;font-size:12px;">${a.threshold}${a.unit || ''}</td>
        </tr>` : ''}
        ${a.description ? `<tr>
          <td colspan="2" style="padding:8px 0 4px;color:#374151;font-size:12px;line-height:1.7;">${a.description}</td>
        </tr>` : ''}
      </table>
      ${a.volumes ? diskVolumeTable(a.volumes) : ''}
    </div>`;
  }).join('');

  const body = `
  <!-- Alert banner -->
  <div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:24px;">
    <p style="margin:0 0 4px;color:#DC2626;font-size:14px;font-weight:800;">CRITICAL — ${totalAlerts} active issue${totalAlerts > 1 ? 's' : ''} detected</p>
    <p style="margin:0;color:#6B7280;font-size:12px;">WeCrew is tracking these unresolved P1 alerts. Immediate action required.</p>
  </div>

  <h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#111827;">P1 Alert Notification</h2>
  <p style="margin:0 0 20px;color:#6B7280;font-size:13px;">Organization: <strong>${data.orgName || 'WeCrew ITSM'}</strong> &nbsp;·&nbsp; Reported: ${now} IST</p>

  ${alertCards}

  <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:14px 18px;margin-top:4px;">
    <p style="margin:0 0 8px;color:#1D4ED8;font-size:12px;font-weight:700;">Recommended Actions</p>
    <ul style="margin:0;padding-left:18px;color:#374151;font-size:12px;line-height:2;">
      <li>SSH into the affected host and investigate disk, CPU, or memory usage</li>
      <li>Clear temp files, rotate logs, or restart the impacted service</li>
      <li>Acknowledge the incident in WeCrew to stop further escalation alerts</li>
      <li>If the issue persists, escalate to the on-call engineer immediately</li>
    </ul>
  </div>

  ${ctaRow([
    { label: 'View Alerts in WeCrew →', url, color: '#DC2626' },
    { label: 'Open Dashboard', url: `${config.frontendUrl}/dashboard`, color: '#fff', outlined: true }
  ])}`;

  return baseLayout(
    `[P1 ALERT] ${totalAlerts} Critical Issue${totalAlerts > 1 ? 's' : ''} — ${data.orgName || 'WeCrew ITSM'}`,
    '#DC2626', 'Alert Notification · WeCrew', body
  );
}

// ── Template 11: Post-Incident RCA Report ────────────────────
// Auto-sent when incident transitions to RESOLVED.
// All analysis is inline — no tool login needed to read the full report.

function renderRCAReport(incident) {
  const orgName  = incident.organization?.name || 'Unknown Org';
  const teamName = incident.assignmentGroup?.name || 'Unassigned';
  const resolver = incident.assignedTo
    ? `${incident.assignedTo.firstName} ${incident.assignedTo.lastName}`
    : 'System';
  const ciName   = incident.configItem?.name || null;

  // ── Extract hostname + IP from description ──────────────
  function extractHostInfo(desc) {
    if (!desc) return { hostname: null, ip: null };
    const hostMatch = desc.match(/(?:node|host|server|device)[:\s]+([a-zA-Z0-9._-]{4,40})/i);
    const ipMatch   = desc.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
    return {
      hostname: ciName || (hostMatch?.[1] || null),
      ip:       ipMatch?.[1] || null,
    };
  }
  const { hostname, ip } = extractHostInfo(incident.description);
  const hostLabel = [hostname, ip ? `(${ip})` : null].filter(Boolean).join(' ') || 'N/A';

  // ── Timestamps ─────────────────────────────────────────
  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', IST_FMT) + ' IST' : 'N/A';
  const createdAt  = fmt(incident.createdAt);
  const resolvedAt = fmt(incident.resolvedAt);
  const durationMs = incident.createdAt && incident.resolvedAt
    ? new Date(incident.resolvedAt) - new Date(incident.createdAt)
    : null;
  const durationStr = durationMs
    ? (() => {
        const m = Math.round(durationMs / 60000);
        if (m >= 1440) return `${Math.floor(m/1440)}d ${Math.floor((m%1440)/60)}h ${m%60}m`;
        return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m} min`;
      })()
    : 'Unknown';

  const pc  = PRIORITY_COLOR[incident.priority] || '#2563EB';
  const pb  = PRIORITY_BG[incident.priority]    || '#EFF6FF';
  const esc = incident.escalationLevel || 0;

  // ── Category-aware root cause suggestions ──────────────
  const CAT_CAUSE = {
    Infrastructure: { cause: 'Resource exhaustion or service crash on a core infrastructure node', root: 'Insufficient capacity headroom or missing auto-restart configuration on the affected service/process.', fix: ['Add resource limits and requests to all K8s pods', 'Configure kubelet liveness/readiness probes', 'Set up node auto-healing via cluster autoscaler', 'Review pod eviction thresholds and PodDisruptionBudgets'] },
    Network:        { cause: 'Network interface or routing failure affecting connectivity', root: 'Physical link instability, misconfigured routing rules, or BGP/OSPF peer loss on the affected switch/router.', fix: ['Implement link aggregation (LACP) for critical uplinks', 'Enable BFD for faster BGP/OSPF convergence', 'Review switch port error counters and SFP module health', 'Add redundant paths with automatic failover'] },
    Database:       { cause: 'Database service unavailability or performance degradation', root: 'Connection pool exhaustion, long-running queries blocking I/O, or disk space pressure on the data volume.', fix: ['Review slow query log and add missing indexes', 'Tune connection pool size and idle timeout', 'Set up automated tablespace growth alerts', 'Schedule regular VACUUM/ANALYZE (PostgreSQL) or OPTIMIZE TABLE (MySQL)'] },
    Application:    { cause: 'Application process crash or unhandled exception in production', root: 'Memory leak, unhandled exception in a new deployment, or dependency service timeout causing cascading failure.', fix: ['Add circuit breakers for downstream service calls', 'Implement structured error logging with stack traces', 'Review recent deployments in the deployment history', 'Add health-check endpoints and automated restart policies'] },
    Security:       { cause: 'Security policy violation or unauthorized access attempt detected', root: 'Misconfigured firewall rule, expired certificate, or brute-force attempt on an exposed service port.', fix: ['Rotate affected credentials and certificates immediately', 'Review and tighten firewall ACLs for the affected service', 'Enable fail2ban or similar brute-force protection', 'Audit user access logs for the affected time window'] },
    Storage:        { cause: 'Storage volume full or I/O saturation on a critical mount point', root: 'Rapid log growth, uncontrolled database expansion, or missing disk usage alerts allowed the volume to fill silently.', fix: ['Implement log rotation with max-size and retention policies', 'Set up disk usage alerts at 70% / 85% / 95% thresholds', 'Archive or compress old data files to secondary storage', 'Review inode usage — full inodes can cause writes to fail even with free space'] },
  };
  const catKey = Object.keys(CAT_CAUSE).find(k => (incident.category || '').toLowerCase().includes(k.toLowerCase())) || 'Infrastructure';
  const catData = CAT_CAUSE[catKey];

  // ── Build timeline from actual timestamps ───────────────
  const timelineItems = [
    { time: createdAt,   dot: '#3B82F6', label: `Incident detected and logged by WeCrew — ${incident.source || 'Manual'} source` },
    esc > 0 ? { time: 'Escalated',  dot: '#DC2626', label: `Escalated to level ${esc} after SLA threshold breached — ${teamName} team notified` } : null,
    { time: 'Acknowledged', dot: '#7C3AED', label: `Incident acknowledged by ${resolver} — investigation started` },
    incident.slaBreached
      ? { time: 'SLA Breached', dot: '#DC2626', label: 'SLA resolution target exceeded — management notified' }
      : null,
    { time: resolvedAt,  dot: '#059669', label: `Incident resolved by ${resolver} — service restored` },
  ].filter(Boolean);

  function timelineDot(item, i, total) {
    return `
    <tr>
      <td style="width:96px;padding:4px 12px 4px 0;text-align:right;vertical-align:top;">
        <span style="color:#9CA3AF;font-size:10px;font-weight:600;font-family:'Courier New',monospace;white-space:nowrap;">${item.time}</span>
      </td>
      <td style="width:20px;text-align:center;vertical-align:top;padding-top:2px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${item.dot};display:inline-block;border:2px solid #fff;box-shadow:0 0 0 2px ${item.dot};"></div>
        ${i < total-1 ? `<div style="width:2px;height:22px;background:#E5E7EB;margin:2px auto 0;"></div>` : ''}
      </td>
      <td style="padding:4px 0 4px 12px;vertical-align:top;">
        <span style="color:#374151;font-size:12px;line-height:1.6;">${item.label}</span>
      </td>
    </tr>`;
  }

  const body = `
  <!-- RCA header banner -->
  <div style="background:#F0FDF4;border-left:4px solid #059669;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
    <p style="margin:0 0 2px;color:#059669;font-size:13px;font-weight:700;">Post-Incident RCA Report — Incident Resolved</p>
    <p style="margin:0;color:#374151;font-size:12px;">This report is auto-generated by WeCrew ITSM upon incident closure. No login required to read.</p>
  </div>

  <!-- Priority badges + number -->
  ${priorityBadge(incident)}
  <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#111827;line-height:1.35;">${incident.shortDescription}</h2>
  <p style="margin:0 0 20px;color:#6B7280;font-size:13px;">
    Organization: <strong style="color:#374151;">${orgName}</strong>
    &nbsp;·&nbsp; Host: <strong style="color:#374151;font-family:'Courier New',monospace;">${hostLabel}</strong>
    &nbsp;·&nbsp; Duration: <strong style="color:#374151;">${durationStr}</strong>
  </p>

  <!-- ── SECTION 1: EXECUTIVE SUMMARY ── -->
  ${sectionLabel('Executive Summary')}
  <div style="background:${pb};border-left:4px solid ${pc};border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
    <p style="margin:0;color:#374151;font-size:13px;line-height:1.8;">
      A <strong>${incident.priority} (${PRIORITY_LABEL[incident.priority] || incident.priority})</strong> incident was raised on
      <strong>${orgName}</strong> affecting <strong>${hostLabel}</strong>.
      The issue — <em>${incident.shortDescription}</em> — was detected at ${createdAt}
      and resolved at ${resolvedAt}, with a total downtime of <strong>${durationStr}</strong>.
      ${esc > 0 ? `The incident was escalated ${esc} time(s) before resolution.` : 'No escalation was required.'}
      ${incident.slaBreached ? ' <strong style="color:#DC2626;">SLA resolution target was breached.</strong>' : ''}
    </p>
  </div>

  <!-- ── SECTION 2: WHAT HAPPENED ── -->
  ${incident.description ? `
  ${sectionLabel('Incident Description')}
  <div style="background:#F9FAFB;border-left:3px solid #E5E7EB;border-radius:0 6px 6px 0;padding:12px 16px;margin-bottom:20px;">
    <p style="margin:0;color:#374151;font-size:12px;line-height:1.9;">${incident.description}</p>
  </div>` : ''}

  <!-- ── SECTION 3: IMPACT ASSESSMENT ── -->
  ${sectionLabel('Impact Assessment')}
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:20px;">
    ${kvRow('Affected System',   hostLabel, '#DC2626')}
    ${kvRow('Organization',      orgName)}
    ${kvRow('Category',          incident.category || 'Infrastructure')}
    ${kvRow('Impact Scope',      incident.impact)}
    ${kvRow('Urgency',           incident.urgency)}
    ${kvRow('Escalation Levels', esc > 0 ? `Escalated ${esc} time(s) — ${teamName} team` : 'No escalation required')}
    ${kvRow('SLA Status',        incident.slaBreached ? 'Resolution target BREACHED' : 'Resolved within SLA target', incident.slaBreached ? '#DC2626' : '#059669')}
    ${kvRow('Total Duration',    durationStr, durationMs > 60*60*1000 ? '#DC2626' : '#374151')}
  </table>

  <!-- ── SECTION 4: ROOT CAUSE ANALYSIS ── -->
  ${sectionLabel('Root Cause Analysis')}
  <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:16px 18px;margin-bottom:16px;">
    <p style="margin:0 0 8px;color:#92400E;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Primary Cause</p>
    <p style="margin:0;color:#374151;font-size:13px;line-height:1.8;">${catData.cause}${hostname ? ` on <strong>${hostname}</strong>` : ''}.</p>
  </div>
  <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px 18px;margin-bottom:20px;">
    <p style="margin:0 0 8px;color:#6B7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Contributing Factors</p>
    <p style="margin:0;color:#374151;font-size:12px;line-height:1.9;">${catData.root}</p>
  </div>

  <!-- ── SECTION 5: RESOLUTION TAKEN ── -->
  ${sectionLabel('Resolution Applied')}
  <div style="background:#F0FDF4;border-left:4px solid #059669;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:20px;">
    <p style="margin:0 0 4px;color:#059669;font-size:12px;font-weight:700;">Resolved by: ${resolver} &nbsp;·&nbsp; ${resolvedAt}</p>
    <p style="margin:0;color:#374151;font-size:12px;line-height:1.9;">${incident.resolutionNotes || 'Resolution notes not provided. Please update the incident with detailed resolution steps for future reference.'}</p>
  </div>

  <!-- ── SECTION 6: TIMELINE OF EVENTS ── -->
  ${sectionLabel('Timeline of Events')}
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin-bottom:20px;">
    ${timelineItems.map((item, i) => timelineDot(item, i, timelineItems.length)).join('')}
  </table>

  ${divider()}

  <!-- ── SECTION 7: INCIDENT DETAILS TABLE ── -->
  ${sectionLabel('Full Incident Details')}
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:20px;">
    ${kvRow('Incident Number',  incident.number, '#4F46E5')}
    ${kvRow('Priority',         `${incident.priority} — ${PRIORITY_LABEL[incident.priority] || ''}`, pc)}
    ${kvRow('Source',           incident.source || 'Manual')}
    ${kvRow('Assigned To',      resolver)}
    ${kvRow('Team',             teamName)}
    ${ciName ? kvRow('CI / Asset', ciName) : ''}
    ${kvRow('Opened',           createdAt)}
    ${kvRow('Resolved',         resolvedAt)}
    ${kvRow('Total Duration',   durationStr)}
    ${incident.resolutionCode ? kvRow('Resolution Code', incident.resolutionCode) : ''}
  </table>

  <!-- ── SECTION 8: PREVENTIVE ACTIONS ── -->
  ${sectionLabel('Preventive Actions & Recommendations')}
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
    ${catData.fix.map((action, i) => `
    <tr>
      <td style="padding:8px 0;vertical-align:top;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
          <tr>
            <td style="width:28px;vertical-align:top;padding-top:1px;">
              <div style="width:22px;height:22px;border-radius:50%;background:#EEF2FF;text-align:center;line-height:22px;font-size:11px;font-weight:800;color:#4F46E5;">${i+1}</div>
            </td>
            <td style="padding-left:10px;vertical-align:top;">
              <p style="margin:0;color:#374151;font-size:12px;line-height:1.7;">${action}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('')}
  </table>`;

  return baseLayout(
    `RCA Report: ${incident.number} — ${orgName}`,
    '#059669', 'Post-Incident Analysis · WeCrew', body
  );
}

// ── RCA subject builder (used by notificationService) ────────
function buildRCASubject(incident) {
  const orgName = incident.organization?.name || 'WeCrew';
  const { hostname, ip } = (() => {
    const desc = incident.description || '';
    const hostMatch = desc.match(/(?:node|host|server|device)[:\s]+([a-zA-Z0-9._-]{4,40})/i);
    const ipMatch   = desc.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
    const ciName    = incident.configItem?.name || null;
    return { hostname: ciName || hostMatch?.[1] || null, ip: ipMatch?.[1] || null };
  })();
  const hostPart = [hostname, ip ? `(${ip})` : null].filter(Boolean).join(' ');
  const issuePart = (incident.shortDescription || '').substring(0, 60);
  return `[RCA] ${orgName}${hostPart ? ' · ' + hostPart : ''} · ${issuePart}`;
}

// ── Template 10: Welcome / Account Created ─────────────────

function renderWelcomeUser(user, tempPassword) {
  const loginUrl   = config.frontendUrl || 'https://itsm.wecrew.in';
  const docsUrl    = `${loginUrl}/help`;
  const firstName  = user.firstName || user.name || 'there';
  const roleLabels = { ADMIN: 'Administrator', MANAGER: 'Team Manager', ENGINEER: 'Engineer', OPERATOR: 'Operator', VIEWER: 'Viewer' };
  const roleLabel  = roleLabels[user.role] || user.role || 'Team Member';
  const orgName    = user.organization?.name || 'your organization';

  const step = (num, label, desc) => `
  <tr>
    <td style="padding:10px 0;vertical-align:top;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tr>
          <td style="width:32px;vertical-align:top;padding-top:1px;">
            <div style="width:28px;height:28px;border-radius:50%;background:#EEF2FF;text-align:center;line-height:28px;font-size:12px;font-weight:800;color:#4F46E5;">${num}</div>
          </td>
          <td style="padding-left:12px;vertical-align:top;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#111827;">${label}</p>
            <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.6;">${desc}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  const body = `
  <!-- Welcome hero -->
  <div style="background:linear-gradient(135deg,#EEF2FF 0%,#F5F3FF 100%);border-radius:10px;padding:24px 20px;margin-bottom:20px;text-align:center;">
    <div style="font-size:32px;margin-bottom:10px;">👋</div>
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#111827;">Welcome to WeCrew, ${firstName}!</h2>
    <p style="margin:0;color:#6B7280;font-size:13px;">Your account has been created for <strong style="color:#374151;">${orgName}</strong>. You're now part of the team.</p>
  </div>

  <!-- Account info box -->
  ${sectionLabel('Your Account Details')}
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
    ${kvRow('Email / Login', user.email, '#4F46E5')}
    ${kvRow('Role', roleLabel)}
    ${kvRow('Organization', orgName)}
    ${tempPassword ? kvRow('Temporary Password', `<code style="background:#F3F4F6;padding:2px 8px;border-radius:4px;font-family:monospace;font-size:13px;font-weight:700;color:#DC2626;">${tempPassword}</code>`) : ''}
  </table>

  ${tempPassword ? `
  <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px 16px;margin-top:12px;">
    <p style="margin:0;color:#92400E;font-size:12px;"><strong>Important:</strong> Change your password immediately after your first sign-in. Your temporary password expires in 24 hours.</p>
  </div>` : ''}

  ${divider()}

  <!-- Quick start steps -->
  ${sectionLabel('Getting Started')}
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
    ${step(1, 'Sign in to WeCrew', `Visit your portal and log in using the credentials above.`)}
    ${step(2, 'Review open incidents', 'Head to the Incidents module to see active issues assigned to your team.')}
    ${step(3, 'Set up your on-call schedule', 'Configure your availability in Teams → On-Call so you receive alerts when needed.')}
    ${step(4, 'Explore integrations', 'Connect Prometheus, Grafana, Slack, and other tools in the Integration Hub.')}
  </table>

  ${ctaRow([
    { label: 'Sign In to WeCrew →', url: loginUrl, color: '#4F46E5' },
    { label: 'View Help & Docs', url: docsUrl, color: '#fff', outlined: true }
  ])}`;

  return baseLayout(`Welcome to WeCrew, ${firstName}!`, '#4F46E5', 'Account Created · WeCrew', body);
}

/**
 * Send a P1 alert notification email with real metrics.
 * Used by escalation engine and manual triggers.
 */
async function sendAlertNotification(to, data) {
  const subject = `[P1 ALERT] ${data.alerts?.length || ''} Critical Issue${(data.alerts?.length || 0) > 1 ? 's' : ''} — ${data.orgName || 'WeCrew ITSM'}`;
  const html = renderAlertNotification(data);
  return sendEmail(to, subject, html, { priority: 10 });
}

// ── Core send function ───────────────────────────────────

/**
 * Send a single email. Queues to DB then attempts delivery.
 * Never throws — errors are logged and recorded in the queue.
 */
async function sendEmail(to, subject, html, options = {}) {
  if (!to) { logger.warn('[emailService] sendEmail called with no recipient'); return; }

  let queueId;
  try {
    const record = await prisma.emailQueue.create({
      data: { to, subject, body: html, status: 'PENDING', priority: options.priority || 0 },
    });
    queueId = record.id;
  } catch (dbErr) {
    logger.error('[emailService] Failed to queue email:', dbErr.message);
  }

  const t = getTransporter();
  if (!t) {
    logger.warn(`[emailService] SMTP not configured — email to ${to} not sent`);
    return;
  }

  try {
    await t.sendMail({ from: config.smtp.from, to, subject, html });
    if (queueId) {
      await prisma.emailQueue.update({ where: { id: queueId }, data: { status: 'SENT', sentAt: new Date() } });
    }
    logger.info(`[emailService] Sent: "${subject}" → ${to}`);
  } catch (err) {
    logger.error(`[emailService] Delivery failed to ${to}: ${err.message}`);
    if (queueId) {
      await prisma.emailQueue.update({
        where: { id: queueId },
        data: { status: 'FAILED', lastError: err.message, attempts: { increment: 1 } },
      });
    }
  }
}

/**
 * Send to multiple recipients sequentially.
 * emails: [{ to, subject, html }]
 */
async function sendBulk(emails = []) {
  for (const email of emails) {
    await sendEmail(email.to, email.subject, email.html, email.options || {});
  }
}

/**
 * Retry FAILED or stuck PENDING emails from the queue.
 * Called by a cron job (e.g. every 5 minutes).
 * Max 3 attempts per email.
 */
async function processEmailQueue() {
  const pending = await prisma.emailQueue.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      attempts: { lt: 3 },
      scheduledAt: { lte: new Date() },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: 20,
  });

  if (!pending.length) return;

  const t = getTransporter();
  if (!t) { logger.warn('[emailService] SMTP not configured, skipping queue processing'); return; }

  logger.info(`[emailService] Processing ${pending.length} queued emails`);

  for (const item of pending) {
    try {
      await t.sendMail({ from: config.smtp.from, to: item.to, subject: item.subject, html: item.body });
      await prisma.emailQueue.update({ where: { id: item.id }, data: { status: 'SENT', sentAt: new Date() } });
      logger.info(`[emailService] Queue processed: "${item.subject}" → ${item.to}`);
    } catch (err) {
      logger.error(`[emailService] Queue retry failed for ${item.to}: ${err.message}`);
      await prisma.emailQueue.update({
        where: { id: item.id },
        data: { status: 'FAILED', lastError: err.message, attempts: { increment: 1 } },
      });
    }
  }
}

// ── Alert Digest Cron — All Orgs ─────────────────────────
// Called every 15 minutes by server.js.
// For each org with FIRING CRITICAL/WARNING alerts, fetches the
// alert list and emails all ADMIN + MANAGER users of that org.
// Sends one consolidated email per org — not per alert.

async function sendAllOrgAlertDigests() {
  try {
    // Find all orgs that have at least one CRITICAL or WARNING alert currently FIRING
    const firingOrgs = await prisma.alert.groupBy({
      by: ['organizationId'],
      where: {
        status:   'FIRING',
        severity: { in: ['CRITICAL', 'WARNING'] },
      },
    });

    if (!firingOrgs.length) {
      logger.debug('[AlertDigest] No orgs with firing alerts — skipping digest');
      return;
    }

    logger.info(`[AlertDigest] Running digest for ${firingOrgs.length} org(s) with firing alerts`);

    for (const { organizationId } of firingOrgs) {
      if (!organizationId) continue;
      try {
        // Fetch org details
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, name: true },
        });
        if (!org) continue;

        // Fetch all FIRING alerts for this org (CRITICAL first, then WARNING)
        const alerts = await prisma.alert.findMany({
          where: {
            organizationId,
            status:   'FIRING',
            severity: { in: ['CRITICAL', 'WARNING'] },
          },
          orderBy: [{ severity: 'asc' }, { firedAt: 'asc' }],
          take: 20,   // cap at 20 alerts per email
        });

        if (!alerts.length) continue;

        // Find all ADMIN + MANAGER users for this org
        const recipients = await prisma.user.findMany({
          where: {
            organizationId,
            role:   { in: ['ADMIN', 'MANAGER'] },
            status: 'ACTIVE',
          },
          select: { email: true, firstName: true },
        });

        if (!recipients.length) {
          logger.warn(`[AlertDigest] No ADMIN/MANAGER recipients for org ${org.name} — skipping`);
          continue;
        }

        // Build alert data for the email template
        const alertData = {
          orgName: org.name,
          alerts: alerts.map(a => {
            // Parse age in minutes
            const ageMin = a.firedAt ? Math.round((Date.now() - new Date(a.firedAt)) / 60000) : 0;
            // Extract host from labels JSON or alert name
            let host = a.instance || a.labels?.instance || '';
            try {
              if (a.labels && typeof a.labels === 'string') {
                const lbl = JSON.parse(a.labels);
                host = lbl.instance || lbl.hostname || lbl.node || host;
              } else if (a.labels && typeof a.labels === 'object') {
                host = a.labels.instance || a.labels.hostname || a.labels.node || host;
              }
            } catch (_) { /* ignore */ }

            return {
              name:        a.alertName || a.name || 'Unknown Alert',
              host:        host || 'N/A',
              status:      a.severity || 'CRITICAL',
              value:       a.value    || null,
              threshold:   a.threshold || null,
              unit:        a.unit     || '',
              age:         ageMin,
              description: a.description || a.summary || null,
            };
          }),
        };

        const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
        const warnCount     = alerts.filter(a => a.severity === 'WARNING').length;
        const subject = `[ALERT DIGEST] ${org.name} · ${criticalCount > 0 ? criticalCount + ' Critical' : ''}${criticalCount > 0 && warnCount > 0 ? ', ' : ''}${warnCount > 0 ? warnCount + ' Warning' : ''} · ${alerts.length} firing`;
        const html    = renderAlertNotification(alertData);

        // Send to every recipient (skip users with no email)
        for (const { email } of recipients) {
          if (!email) continue;
          await sendEmail(email, subject, html, { priority: criticalCount > 0 ? 10 : 5 });
        }

        logger.info(`[AlertDigest] ${org.name}: ${alerts.length} alerts → ${recipients.map(r => r.email).join(', ')}`);
      } catch (orgErr) {
        logger.error(`[AlertDigest] Error processing org ${organizationId}: ${orgErr.message}`);
      }
    }
  } catch (err) {
    logger.error('[AlertDigest] Fatal error in sendAllOrgAlertDigests:', err.message);
  }
}

// ── Exports ──────────────────────────────────────────────

module.exports = {
  sendEmail,
  sendBulk,
  sendAlertNotification,
  sendAllOrgAlertDigests,
  processEmailQueue,
  templates: {
    incidentCreated:        renderIncidentCreated,
    incidentAssigned:       renderIncidentAssigned,
    incidentEscalated:      renderIncidentEscalated,
    incidentResolved:       renderIncidentResolved,
    slaWarning:             renderSLAWarning,
    slaBreached:            renderSLABreached,
    changeApprovalRequest:  renderChangeApprovalRequest,
    dailyDigest:            renderDailyDigest,
    alertNotification:      renderAlertNotification,
    welcomeUser:            renderWelcomeUser,
    rcaReport:              renderRCAReport,
  },
  buildRCASubject,
  buildIncidentSubject,
};
