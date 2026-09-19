// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Incident titles and notification subjects
//
// An on-call engineer should know from the subject line alone: how bad,
// which customer, which application, which server, what broke, and when.
//
//   title:   [CRITICAL] Acme Corp · payments-api · web-01 (10.0.0.5) — HighCPU
//   subject: [P1 CRITICAL] Acme Corp · payments-api · web-01 (10.0.0.5) · HighCPU · 19 Sep 2026, 21:05 IST (INC0000123)
//            with [ASSIGNED] / [ESCALATED] / [RESOLVED] in front for follow-up events.
// ═══════════════════════════════════════════════════════════

const SEVERITIES = ['CRITICAL', 'MAJOR', 'HIGH', 'WARNING', 'MINOR', 'INFO'];
const SEVERITY_BY_PRIORITY = { P1: 'CRITICAL', P2: 'MAJOR', P3: 'WARNING', P4: 'INFO' };
const TITLE_MAX = 200;

/** Application name from Prometheus/Kubernetes labels, most specific first. */
function appFromLabels(labels = {}) {
  return labels.application || labels.app || labels['app_kubernetes_io_name'] || labels['app.kubernetes.io/name']
    || labels.service || labels.service_name || labels.deployment || labels.container || labels.job || '';
}

function hostPart(host, ip) {
  if (host && ip && ip !== host) return `${host} (${ip})`;
  return host || ip || '';
}

/** In-app incident title (Incident.shortDescription), ≤ 200 chars. */
function alertIncidentTitle({ severity, alertName, orgName, app, host, ip }) {
  const sev = String(severity || 'WARNING').toUpperCase();
  const where = [orgName, app, hostPart(host, ip)].filter(Boolean).join(' · ');
  const title = where ? `[${sev}] ${where} — ${alertName}` : `[${sev}] ${alertName}`;
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "19 Sep 2026, 21:05 IST" — ops teams read times in IST. Built from numeric
 * parts: locale month names vary across ICU builds (en-IN says "Sept").
 */
function formatIST(date) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day} ${MONTHS[Number(p.month) - 1]} ${p.year}, ${p.hour}:${p.minute} IST`;
}

function severityOf(incident) {
  const m = String(incident.shortDescription || '').match(/^\[([A-Z]+)\]/);
  if (m && SEVERITIES.includes(m[1])) return m[1];
  return SEVERITY_BY_PRIORITY[incident.priority] || 'WARNING';
}

/** The "what broke" part: the alert name when known, else the title minus our prefix/context. */
function issueOf(incident) {
  if (incident.sourceAlertName) return incident.sourceAlertName;
  let t = String(incident.shortDescription || '').replace(/^\[[A-Z]+\]\s*/, '');
  const dash = t.lastIndexOf(' — ');
  if (dash !== -1) t = t.slice(dash + 3);
  return t.slice(0, 80);
}

/** Customer / application / host / IP as recorded on the incident. */
function contextOf(incident) {
  const desc = incident.description || '';
  const line = (label) => (desc.match(new RegExp(`^${label}:\\s*(.+)$`, 'mi')) || [])[1]?.trim() || '';
  const hostMatch = desc.match(/(?:node|host|hostname|server|device)[:\s]+([a-zA-Z0-9._-]{4,63})/i);
  const ipMatch = desc.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
  return {
    orgName: incident.organization?.name || '',
    app: line('Application'),
    host: incident.configItem?.name || line('Hostname') || hostMatch?.[1] || '',
    ip: line('IP Address') || ipMatch?.[1] || '',
  };
}

const EVENT_TAGS = { Assigned: '[ASSIGNED] ', Escalated: '[ESCALATED] ', Resolved: '[RESOLVED] ' };

/** Email / chat subject for an incident notification. */
function incidentSubject(incident, event) {
  const { orgName, app, host, ip } = contextOf(incident);
  const parts = [
    orgName || 'WeCrew',
    app,
    hostPart(host, ip),
    issueOf(incident),
    formatIST(incident.createdAt),
  ].filter(Boolean);
  const head = `${EVENT_TAGS[event] || ''}[${incident.priority || 'P3'} ${severityOf(incident)}]`;
  return `${head} ${parts.join(' · ')}${incident.number ? ` (${incident.number})` : ''}`;
}

module.exports = {
  appFromLabels, alertIncidentTitle, incidentSubject, formatIST, severityOf, issueOf, contextOf,
};
