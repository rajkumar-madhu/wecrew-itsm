// ═══════════════════════════════════════════════════════════
// Test: Send P1 Escalation Email for INC0000032 (new dark style)
// Run from backend/: DATABASE_URL=... SMTP_PASS=... node prisma/send-test-escalation-email.js
// ═══════════════════════════════════════════════════════════

process.env.JWT_SECRET          = process.env.JWT_SECRET          || 'linkedeye-jwt-super-secret-2026';
process.env.FRONTEND_URL        = process.env.FRONTEND_URL        || 'https://fs-le-dev-inc.finspot.in';
process.env.SMTP_HOST           = process.env.SMTP_HOST           || 'smtp.office365.com';
process.env.SMTP_PORT           = process.env.SMTP_PORT           || '587';
process.env.SMTP_USER           = process.env.SMTP_USER           || 'eva@finspot.in';
process.env.SMTP_PASS           = process.env.SMTP_PASS           || 'nwswgmrvgqvhjbbt';
process.env.EMAIL_FROM          = process.env.EMAIL_FROM          || 'eva@finspot.in';
process.env.JWT_REFRESH_SECRET  = process.env.JWT_REFRESH_SECRET  || 'refresh-secret';

const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  console.log('Fetching INC0000032 from K8s postgres...\n');

  const incident = await prisma.incident.findFirst({
    where: { number: 'INC0000032' },
    include: {
      organization:    { select: { name: true, slug: true, serverIp: true, fqdn: true } },
      assignmentGroup: { select: { name: true } },
      assignedTo:      { select: { firstName: true, lastName: true } },
      configItem:      { select: { name: true, ipAddress: true, hostname: true } },
    },
  });

  if (!incident) {
    console.error('INC0000032 not found. Check DATABASE_URL.');
    process.exit(1);
  }

  console.log(`Found: ${incident.number} — ${incident.shortDescription}`);
  console.log(`Priority: ${incident.priority} | State: ${incident.state} | Org: ${incident.organization?.name}`);
  console.log(`Created: ${incident.createdAt}\n`);

  // Load the real emailService to use renderIncidentEscalated
  // (it reads config.smtp etc so we must set process.env first — done above)
  const emailService = require('../src/services/emailService');

  // Real metrics for this incident
  const metrics = [
    { host: 'lemonn-mum-le (10.41.0.110)', metric: 'CPU Utilization',    value: '7.2%',    threshold: '< 80%',  critical: false, warning: false },
    { host: 'lemonn-mum-le (10.41.0.110)', metric: 'Memory Utilization', value: '64%',     threshold: '< 85%',  critical: false, warning: false },
    { host: 'lemonn-mum-le (10.41.0.110)', metric: 'kubelet Process',    value: 'DOWN',    threshold: 'Running', critical: true,  warning: false },
    { host: 'lemonn-mum-le (10.41.0.110)', metric: 'Node Ready Status',  value: 'NotReady',threshold: 'Ready',   critical: true,  warning: false },
    { host: 'K8s Cluster — Lemonn Mumbai', metric: 'Running Pods',       value: '58 / 60', threshold: '>= 60',  critical: false, warning: true  },
    { host: 'K8s Cluster — Lemonn Mumbai', metric: 'PDB Violations',     value: '3',       threshold: '0',       critical: true,  warning: false },
  ];

  // Timeline events
  const timeline = [
    { time: '25-Feb 12:47', label: 'kubelet stopped on lemonn-mum-le (10.41.0.110)',  dot: '#EF4444' },
    { time: '25-Feb 12:48', label: 'Prometheus fired: KubeNodeNotReady',               dot: '#EF4444' },
    { time: '25-Feb 12:49', label: '58 pods affected, 3 PDB violations',               dot: '#F59E0B' },
    { time: '25-Feb 12:55', label: 'INC0000032 created by Argus alert pipeline',       dot: '#3B82F6' },
    { time: 'Now',          label: `UNRESOLVED — SLA BREACHED — L1 Escalation`,        dot: '#EF4444' },
  ];

  // Remediation commands
  const commands = [
    'ssh -p 4422 finadmin@154.210.170.126',
    'sudo systemctl restart kubelet',
    'kubectl get nodes -o wide',
    'kubectl get pods -A | grep -v Running',
  ];

  const html = emailService.templates.incidentEscalated(incident, {
    escalationLevel: 1,
    metrics,
    timeline,
    commands,
  });

  // Transporter
  const transporter = nodemailer.createTransport({
    host:       process.env.SMTP_HOST,
    port:       parseInt(process.env.SMTP_PORT, 10),
    secure:     false,
    requireTLS: true,
    auth:       { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls:        { ciphers: 'SSLv3' },
  });

  const elapsedDays = Math.floor((Date.now() - new Date(incident.createdAt)) / 86400000);
  const to = 'rajkumar.madhu@finspot.in';

  console.log(`Sending to: ${to}`);
  const info = await transporter.sendMail({
    from:    `"FinSpot ITSM Tool" <${process.env.SMTP_USER}>`,
    to,
    subject: `[P1 ESCALATION L1] ${incident.number} — ${incident.organization?.name} · lemonn-mum-le (10.41.0.110) · UNRESOLVED ${elapsedDays}d`,
    html,
  });

  console.log(`\n✓ Email sent!`);
  console.log(`  Message ID : ${info.messageId}`);
  console.log(`  Accepted   : ${info.accepted?.join(', ')}`);
  console.log(`  Response   : ${info.response}`);

  // Also generate the one-click ack URL for verification
  const token = jwt.sign({ incidentId: incident.id, action: 'ack' }, process.env.JWT_SECRET, { expiresIn: '24h' });
  console.log(`\n✓ One-click acknowledge URL (24h):`);
  console.log(`  https://fs-le-dev-inc.finspot.in/api/v1/incidents/ack?token=${token}`);
}

main()
  .catch(e => { console.error('\n✗ Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
