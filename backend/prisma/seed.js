// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Database Seed Script
// Run: npx prisma db seed
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

const prisma = new PrismaClient();
const PASSWORD = 'LinkedEye@2026';

function daysAgo(d) { return new Date(Date.now() - d * 86400000); }
function hoursAgo(h) { return new Date(Date.now() - h * 3600000); }
function minsAgo(m) { return new Date(Date.now() - m * 60000); }

async function main() {
  console.log('Seeding LinkedEye database...');
  const hash = await bcrypt.hash(PASSWORD, 12);

  // ── Users ───────────────────────────────────────────
  const users = [
    { id: uuid(), email: 'rajkumar@santhira.com', password: hash, firstName: 'Rajkumar', lastName: 'M', role: 'ADMIN', department: 'Platform Engineering', jobTitle: 'Platform Admin', skills: ['kubernetes', 'terraform', 'prometheus'] },
    { id: uuid(), email: 'priya@santhira.com', password: hash, firstName: 'Priya', lastName: 'S', role: 'MANAGER', department: 'DevOps', jobTitle: 'DevOps Manager', skills: ['docker', 'ci-cd', 'ansible'] },
    { id: uuid(), email: 'arun@santhira.com', password: hash, firstName: 'Arun', lastName: 'K', role: 'MANAGER', department: 'DBA', jobTitle: 'DBA Lead', skills: ['postgresql', 'mongodb', 'redis'] },
    { id: uuid(), email: 'kavitha@santhira.com', password: hash, firstName: 'Kavitha', lastName: 'R', role: 'ENGINEER', department: 'Platform Engineering', jobTitle: 'SRE Engineer', skills: ['kubernetes', 'golang', 'prometheus'] },
    { id: uuid(), email: 'mohan@santhira.com', password: hash, firstName: 'Mohan', lastName: 'V', role: 'ENGINEER', department: 'DevOps', jobTitle: 'DevOps Engineer', skills: ['terraform', 'aws', 'docker'] },
    { id: uuid(), email: 'deepa@santhira.com', password: hash, firstName: 'Deepa', lastName: 'L', role: 'ENGINEER', department: 'AI/ML', jobTitle: 'ML Engineer', skills: ['python', 'pytorch', 'ollama'] },
    { id: uuid(), email: 'ravi@santhira.com', password: hash, firstName: 'Ravi', lastName: 'P', role: 'ENGINEER', department: 'Network', jobTitle: 'Network Engineer', skills: ['cisco', 'juniper', 'bgp'] },
    { id: uuid(), email: 'anitha@santhira.com', password: hash, firstName: 'Anitha', lastName: 'G', role: 'OPERATOR', department: 'NOC', jobTitle: 'NOC Operator', skills: ['monitoring', 'triage'] },
    { id: uuid(), email: 'suresh@santhira.com', password: hash, firstName: 'Suresh', lastName: 'T', role: 'OPERATOR', department: 'NOC', jobTitle: 'NOC Operator', skills: ['monitoring', 'incident-triage'] },
    { id: uuid(), email: 'viewer@santhira.com', password: hash, firstName: 'Demo', lastName: 'Viewer', role: 'VIEWER', department: 'Management', jobTitle: 'Executive', skills: [] },
  ];

  for (const u of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: u });
  }
  console.log(`  ✓ ${users.length} users`);

  // ── Teams ───────────────────────────────────────────
  const teams = [
    { id: uuid(), name: 'Platform Engineering', description: 'Kubernetes, infra, SRE', managerId: users[0].id, email: 'platform@santhira.com', slackChannel: '#platform' },
    { id: uuid(), name: 'DevOps', description: 'CI/CD, automation, deployments', managerId: users[1].id, email: 'devops@santhira.com', slackChannel: '#devops' },
    { id: uuid(), name: 'DBA', description: 'Database administration', managerId: users[2].id, email: 'dba@santhira.com', slackChannel: '#dba' },
    { id: uuid(), name: 'AI/ML Engineering', description: 'ML models, Ollama, Flowise', managerId: users[0].id, email: 'aiml@santhira.com', slackChannel: '#ai-ml' },
    { id: uuid(), name: 'Network Operations', description: 'Network, firewall, DNS', managerId: users[1].id, email: 'network@santhira.com', slackChannel: '#network-ops' },
  ];

  for (const t of teams) { await prisma.team.upsert({ where: { id: t.id }, update: {}, create: t }); }
  console.log(`  ✓ ${teams.length} teams`);

  // ── Team Members ────────────────────────────────────
  const memberships = [
    { teamId: teams[0].id, userId: users[0].id, role: 'LEAD' },
    { teamId: teams[0].id, userId: users[3].id, role: 'MEMBER' },
    { teamId: teams[1].id, userId: users[1].id, role: 'LEAD' },
    { teamId: teams[1].id, userId: users[4].id, role: 'MEMBER' },
    { teamId: teams[2].id, userId: users[2].id, role: 'LEAD' },
    { teamId: teams[3].id, userId: users[5].id, role: 'MEMBER' },
    { teamId: teams[4].id, userId: users[6].id, role: 'MEMBER' },
    { teamId: teams[0].id, userId: users[7].id, role: 'OBSERVER' },
  ];

  for (const m of memberships) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: m.teamId, userId: m.userId } },
      update: {}, create: { id: uuid(), ...m },
    });
  }
  console.log(`  ✓ ${memberships.length} team memberships`);

  // ── SLA Definitions ─────────────────────────────────
  const slas = [
    { name: 'P1 — Critical', priority: 'P1', responseTimeMinutes: 5, resolutionTimeMinutes: 60 },
    { name: 'P2 — High', priority: 'P2', responseTimeMinutes: 15, resolutionTimeMinutes: 240 },
    { name: 'P3 — Medium', priority: 'P3', responseTimeMinutes: 60, resolutionTimeMinutes: 1440 },
    { name: 'P4 — Low', priority: 'P4', responseTimeMinutes: 240, resolutionTimeMinutes: 4320 },
  ];
  for (const s of slas) { await prisma.sLADefinition.create({ data: s }); }
  console.log('  ✓ 4 SLA definitions');

  // ── Configuration Items ─────────────────────────────
  const cis = [
    { name: 'k8s-prod-01', type: 'KUBERNETES_CLUSTER', status: 'LIVE', ipAddress: '10.0.1.10', hostname: 'k8s-prod-01.santhira.local', cpu: '64 vCPU', memory: '256GB', os: 'Ubuntu 22.04', ownerId: users[0].id, supportGroupId: teams[0].id, monitoringEnabled: true, prometheusJob: 'kubernetes-nodes' },
    { name: 'k8s-prod-02', type: 'KUBERNETES_CLUSTER', status: 'LIVE', ipAddress: '10.0.1.11', hostname: 'k8s-prod-02.santhira.local', cpu: '64 vCPU', memory: '256GB', os: 'Ubuntu 22.04', ownerId: users[0].id, supportGroupId: teams[0].id, monitoringEnabled: true },
    { name: 'mongodb-rs-01', type: 'DATABASE', status: 'LIVE', ipAddress: '10.0.2.10', hostname: 'mongo-rs01.santhira.local', cpu: '16 vCPU', memory: '64GB', storage: '2TB NVMe', ownerId: users[2].id, supportGroupId: teams[2].id, monitoringEnabled: true, prometheusJob: 'mongodb' },
    { name: 'postgresql-primary', type: 'DATABASE', status: 'LIVE', ipAddress: '10.0.2.20', hostname: 'pg-primary.santhira.local', cpu: '16 vCPU', memory: '64GB', storage: '1TB SSD', ownerId: users[2].id, supportGroupId: teams[2].id, monitoringEnabled: true },
    { name: 'redis-cluster', type: 'DATABASE', status: 'LIVE', ipAddress: '10.0.2.30', hostname: 'redis.santhira.local', cpu: '8 vCPU', memory: '32GB', ownerId: users[2].id, supportGroupId: teams[2].id },
    { name: 'ollama-gpu-01', type: 'SERVER', status: 'LIVE', ipAddress: '10.0.3.10', hostname: 'ollama-01.santhira.local', cpu: '32 vCPU', memory: '128GB', ownerId: users[5].id, supportGroupId: teams[3].id },
    { name: 'ollama-gpu-02', type: 'SERVER', status: 'LIVE', ipAddress: '10.0.3.11', hostname: 'ollama-02.santhira.local', cpu: '32 vCPU', memory: '128GB', ownerId: users[5].id, supportGroupId: teams[3].id },
    { name: 'haproxy-lb', type: 'LOAD_BALANCER', status: 'LIVE', ipAddress: '10.0.0.100', hostname: 'lb.santhira.local', ownerId: users[6].id, supportGroupId: teams[4].id },
    { name: 'core-switch-01', type: 'NETWORK', status: 'LIVE', ipAddress: '10.0.0.1', hostname: 'core-sw-01.santhira.local', manufacturer: 'Cisco', model: 'Nexus 9000', ownerId: users[6].id, supportGroupId: teams[4].id },
    { name: 'firewall-01', type: 'NETWORK', status: 'LIVE', ipAddress: '10.0.0.2', hostname: 'fw-01.santhira.local', manufacturer: 'Palo Alto', model: 'PA-3260', ownerId: users[6].id, supportGroupId: teams[4].id },
    { name: 'linkedeye-api', type: 'APPLICATION', status: 'LIVE', hostname: 'api.linkedeye.santhira.com', ownerId: users[0].id, supportGroupId: teams[0].id, monitoringEnabled: true },
    { name: 'linkedeye-frontend', type: 'APPLICATION', status: 'LIVE', hostname: 'app.linkedeye.santhira.com', ownerId: users[0].id, supportGroupId: teams[0].id },
    { name: 'grafana', type: 'APPLICATION', status: 'LIVE', ipAddress: '10.0.4.10', hostname: 'grafana.santhira.local', ownerId: users[0].id, supportGroupId: teams[0].id },
    { name: 'prometheus', type: 'APPLICATION', status: 'LIVE', ipAddress: '10.0.4.11', hostname: 'prometheus.santhira.local', ownerId: users[0].id, supportGroupId: teams[0].id },
    { name: 'vm-staging-01', type: 'VM', status: 'LIVE', ipAddress: '10.0.5.10', hostname: 'staging-01.santhira.local', cpu: '8 vCPU', memory: '16GB', ownerId: users[4].id, supportGroupId: teams[1].id },
  ];

  const ciRecords = [];
  for (const ci of cis) {
    const record = await prisma.configurationItem.create({ data: ci });
    ciRecords.push(record);
  }
  console.log(`  ✓ ${cis.length} configuration items`);

  // ── Incidents ───────────────────────────────────────
  const incidentData = [
    { shortDescription: 'k8s API server high latency (>500ms p99)', impact: 'ENTERPRISE', urgency: 'CRITICAL', priority: 'P1', state: 'IN_PROGRESS', category: 'Infrastructure', configItemId: ciRecords[0].id, assignedToId: users[3].id, assignmentGroupId: teams[0].id, source: 'PROMETHEUS' },
    { shortDescription: 'MongoDB replication lag exceeds 30s', impact: 'DEPARTMENT', urgency: 'HIGH', priority: 'P2', state: 'IN_PROGRESS', category: 'Database', configItemId: ciRecords[2].id, assignedToId: users[2].id, assignmentGroupId: teams[2].id, source: 'PROMETHEUS' },
    { shortDescription: 'Ollama GPU OOM on Qwen3-32B inference', impact: 'TEAM', urgency: 'HIGH', priority: 'P2', state: 'ESCALATED', category: 'AI/ML', configItemId: ciRecords[5].id, assignedToId: users[5].id, assignmentGroupId: teams[3].id },
    { shortDescription: 'SSL certificate expiring in 7 days', impact: 'ENTERPRISE', urgency: 'MEDIUM', priority: 'P2', state: 'NEW', category: 'Security', assignedToId: users[4].id, assignmentGroupId: teams[1].id },
    { shortDescription: 'Disk usage >90% on postgresql-primary', impact: 'DEPARTMENT', urgency: 'HIGH', priority: 'P2', state: 'IN_PROGRESS', category: 'Database', configItemId: ciRecords[3].id, assignedToId: users[2].id, assignmentGroupId: teams[2].id, source: 'PROMETHEUS' },
    { shortDescription: 'Grafana dashboard 404 after upgrade', impact: 'TEAM', urgency: 'MEDIUM', priority: 'P3', state: 'RESOLVED', category: 'Monitoring', configItemId: ciRecords[12].id, assignedToId: users[3].id, assignmentGroupId: teams[0].id, resolvedAt: daysAgo(1) },
    { shortDescription: 'Slack notification delivery delay', impact: 'TEAM', urgency: 'LOW', priority: 'P4', state: 'RESOLVED', category: 'Integration', assignedToId: users[4].id, assignmentGroupId: teams[1].id, resolvedAt: daysAgo(2) },
    { shortDescription: 'Redis cluster node flapping', impact: 'DEPARTMENT', urgency: 'CRITICAL', priority: 'P1', state: 'RESOLVED', category: 'Database', configItemId: ciRecords[4].id, assignedToId: users[2].id, assignmentGroupId: teams[2].id, resolvedAt: daysAgo(3) },
    { shortDescription: 'Pod evictions in linkedeye-core namespace', impact: 'TEAM', urgency: 'HIGH', priority: 'P2', state: 'ON_HOLD', category: 'Infrastructure', configItemId: ciRecords[0].id, assignedToId: users[3].id, assignmentGroupId: teams[0].id },
    { shortDescription: 'CI/CD pipeline timeout on staging deploy', impact: 'TEAM', urgency: 'MEDIUM', priority: 'P3', state: 'NEW', category: 'DevOps', assignedToId: users[4].id, assignmentGroupId: teams[1].id },
    { shortDescription: 'Network packet loss between DC racks', impact: 'ENTERPRISE', urgency: 'HIGH', priority: 'P1', state: 'IN_PROGRESS', category: 'Network', configItemId: ciRecords[8].id, assignedToId: users[6].id, assignmentGroupId: teams[4].id },
    { shortDescription: 'DNS resolution intermittent failures', impact: 'DEPARTMENT', urgency: 'MEDIUM', priority: 'P2', state: 'NEW', category: 'Network', assignedToId: users[6].id, assignmentGroupId: teams[4].id },
    { shortDescription: 'Prometheus scrape target down: etcd', impact: 'TEAM', urgency: 'MEDIUM', priority: 'P3', state: 'IN_PROGRESS', category: 'Monitoring', configItemId: ciRecords[13].id, assignedToId: users[3].id, assignmentGroupId: teams[0].id, source: 'PROMETHEUS' },
    { shortDescription: 'User auth token refresh loop', impact: 'INDIVIDUAL', urgency: 'HIGH', priority: 'P3', state: 'RESOLVED', category: 'Application', configItemId: ciRecords[10].id, assignedToId: users[0].id, assignmentGroupId: teams[0].id, resolvedAt: daysAgo(1) },
    { shortDescription: 'HAProxy health check failing for backend pool', impact: 'DEPARTMENT', urgency: 'HIGH', priority: 'P2', state: 'IN_PROGRESS', category: 'Infrastructure', configItemId: ciRecords[7].id, assignedToId: users[6].id, assignmentGroupId: teams[4].id },
    { shortDescription: 'Email notification queue backlog', impact: 'TEAM', urgency: 'LOW', priority: 'P4', state: 'NEW', category: 'Application', assignedToId: users[4].id, assignmentGroupId: teams[1].id },
    { shortDescription: 'Staging VM disk full', impact: 'INDIVIDUAL', urgency: 'LOW', priority: 'P4', state: 'CLOSED', category: 'Infrastructure', configItemId: ciRecords[14].id, assignedToId: users[4].id, assignmentGroupId: teams[1].id, resolvedAt: daysAgo(5), closedAt: daysAgo(4) },
    { shortDescription: 'Flowise workflow execution timeout', impact: 'TEAM', urgency: 'MEDIUM', priority: 'P3', state: 'IN_PROGRESS', category: 'AI/ML', assignedToId: users[5].id, assignmentGroupId: teams[3].id },
    { shortDescription: 'Firewall rule blocking legitimate traffic', impact: 'ENTERPRISE', urgency: 'CRITICAL', priority: 'P1', state: 'RESOLVED', category: 'Security', configItemId: ciRecords[9].id, assignedToId: users[6].id, assignmentGroupId: teams[4].id, resolvedAt: hoursAgo(6) },
    { shortDescription: 'LinkedEye API 502 errors from ingress', impact: 'ENTERPRISE', urgency: 'HIGH', priority: 'P1', state: 'IN_PROGRESS', category: 'Application', configItemId: ciRecords[10].id, assignedToId: users[0].id, assignmentGroupId: teams[0].id },
  ];

  let incNum = 1;
  for (const inc of incidentData) {
    await prisma.incident.create({
      data: {
        number: `INC${String(incNum++).padStart(7, '0')}`,
        createdById: users[Math.floor(Math.random() * 3)].id,
        createdAt: daysAgo(Math.floor(Math.random() * 14)),
        ...inc,
      },
    });
  }
  console.log(`  ✓ ${incidentData.length} incidents`);

  // ── Changes ─────────────────────────────────────────
  const changeData = [
    { shortDescription: 'Upgrade K8s cluster to v1.29', type: 'NORMAL', state: 'SCHEDULED', riskLevel: 'HIGH', assignedToId: users[3].id, assignmentGroupId: teams[0].id, justification: 'Security patches and feature improvements', implementationPlan: '1. Drain nodes\n2. Upgrade control plane\n3. Upgrade workers\n4. Verify', rollbackPlan: 'Restore etcd snapshot', plannedStartDate: daysAgo(-2) },
    { shortDescription: 'Deploy LinkedEye v2.1 release', type: 'NORMAL', state: 'APPROVAL', riskLevel: 'MEDIUM', assignedToId: users[4].id, assignmentGroupId: teams[1].id, gitRepoUrl: 'https://github.com/santhira/linkedeye', gitBranch: 'release/2.1' },
    { shortDescription: 'Add Ollama Qwen3-32B model', type: 'STANDARD', state: 'IMPLEMENTING', riskLevel: 'LOW', assignedToId: users[5].id, assignmentGroupId: teams[3].id, actualStartDate: hoursAgo(2) },
    { shortDescription: 'Emergency firewall rule fix', type: 'EMERGENCY', state: 'REVIEW', riskLevel: 'HIGH', assignedToId: users[6].id, assignmentGroupId: teams[4].id, actualStartDate: hoursAgo(6), actualEndDate: hoursAgo(5) },
    { shortDescription: 'PostgreSQL version upgrade 15→16', type: 'NORMAL', state: 'ASSESSMENT', riskLevel: 'HIGH', assignedToId: users[2].id, assignmentGroupId: teams[2].id },
  ];

  let chgNum = 1;
  for (const chg of changeData) {
    await prisma.change.create({
      data: { number: `CHG${String(chgNum++).padStart(7, '0')}`, createdById: users[0].id, createdAt: daysAgo(Math.floor(Math.random() * 10)), ...chg },
    });
  }
  console.log(`  ✓ ${changeData.length} changes`);

  // ── Problems ────────────────────────────────────────
  const problemData = [
    { shortDescription: 'Recurring K8s API server latency spikes', state: 'RCA_IN_PROGRESS', priority: 'P2', category: 'Infrastructure', assignedToId: users[3].id, assignmentGroupId: teams[0].id, rootCause: 'etcd compaction not running frequently enough', rootCauseAnalysis: { whys: ['API latency >500ms', 'etcd read latency high', 'etcd DB size 4GB', 'Compaction interval too long', 'Default config not tuned for workload'] } },
    { shortDescription: 'MongoDB replication lag during batch jobs', state: 'KNOWN_ERROR', priority: 'P2', category: 'Database', assignedToId: users[2].id, assignmentGroupId: teams[2].id, isKnownError: true, workaround: 'Schedule batch jobs during off-peak hours', workaroundEffective: true },
    { shortDescription: 'Intermittent DNS resolution failures', state: 'INVESTIGATION', priority: 'P3', category: 'Network', assignedToId: users[6].id, assignmentGroupId: teams[4].id },
    { shortDescription: 'OOM kills on Ollama GPU nodes', state: 'RCA_IN_PROGRESS', priority: 'P2', category: 'AI/ML', assignedToId: users[5].id, assignmentGroupId: teams[3].id },
    { shortDescription: 'Session token refresh race condition', state: 'RESOLVED', priority: 'P3', category: 'Application', assignedToId: users[0].id, assignmentGroupId: teams[0].id, rootCause: 'Race condition in concurrent token refresh requests', permanentFix: 'Added mutex lock on refresh endpoint', fixImplemented: true },
  ];

  let prbNum = 1;
  for (const prb of problemData) {
    await prisma.problem.create({
      data: { number: `PRB${String(prbNum++).padStart(7, '0')}`, createdById: users[0].id, createdAt: daysAgo(Math.floor(Math.random() * 20)), ...prb },
    });
  }
  console.log(`  ✓ ${problemData.length} problems`);

  // ── Alerts ──────────────────────────────────────────
  const alertData = [
    { name: 'KubeAPIServerLatencyHigh', severity: 'CRITICAL', status: 'FIRING', source: 'PROMETHEUS', metric: 'apiserver_request_duration_seconds', currentValue: '0.85s', threshold: '0.5s', configItemId: ciRecords[0].id },
    { name: 'MongoDBReplicationLag', severity: 'WARNING', status: 'FIRING', source: 'PROMETHEUS', metric: 'mongodb_repl_lag_seconds', currentValue: '35s', threshold: '10s', configItemId: ciRecords[2].id },
    { name: 'NodeDiskPressure', severity: 'WARNING', status: 'FIRING', source: 'PROMETHEUS', metric: 'node_filesystem_avail_bytes', currentValue: '8%', threshold: '10%', configItemId: ciRecords[3].id },
    { name: 'OllamaGPUMemoryHigh', severity: 'CRITICAL', status: 'FIRING', source: 'PROMETHEUS', metric: 'gpu_memory_used_bytes', currentValue: '95%', threshold: '85%', configItemId: ciRecords[5].id },
    { name: 'HAProxyBackendDown', severity: 'CRITICAL', status: 'FIRING', source: 'PROMETHEUS', metric: 'haproxy_backend_status', currentValue: '2/5 up', threshold: '5/5', configItemId: ciRecords[7].id },
    { name: 'EtcdSlowQueries', severity: 'WARNING', status: 'ACKNOWLEDGED', source: 'PROMETHEUS', metric: 'etcd_disk_backend_commit_duration_seconds', currentValue: '0.3s', threshold: '0.1s' },
    { name: 'RedisMemoryUsageHigh', severity: 'WARNING', status: 'RESOLVED', source: 'PROMETHEUS', metric: 'redis_memory_used_bytes', currentValue: '75%', threshold: '80%', configItemId: ciRecords[4].id, resolvedAt: hoursAgo(2) },
    { name: 'CertExpiryWarning', severity: 'WARNING', status: 'FIRING', source: 'PROMETHEUS', metric: 'cert_expiry_days', currentValue: '7d', threshold: '14d' },
    { name: 'PodCrashLoopBackOff', severity: 'CRITICAL', status: 'FIRING', source: 'PROMETHEUS', metric: 'kube_pod_status_phase', currentValue: 'CrashLoopBackOff' },
    { name: 'HighErrorRate5xx', severity: 'CRITICAL', status: 'FIRING', source: 'PROMETHEUS', metric: 'http_requests_total{status=~"5.."}', currentValue: '12%', threshold: '1%', configItemId: ciRecords[10].id },
  ];

  let alertNum = 1;
  for (const a of alertData) {
    await prisma.alert.create({
      data: { alertId: `alert-${alertNum++}`, firedAt: hoursAgo(Math.floor(Math.random() * 48)), ...a },
    });
  }
  console.log(`  ✓ ${alertData.length} alerts`);

  // ── Integrations ────────────────────────────────────
  const integrations = [
    { name: 'Prometheus', type: 'PROMETHEUS', status: 'ACTIVE', lastSyncAt: minsAgo(1) },
    { name: 'Grafana', type: 'GRAFANA', status: 'ACTIVE', lastSyncAt: minsAgo(5) },
    { name: 'Loki', type: 'LOKI', status: 'ACTIVE', lastSyncAt: minsAgo(2) },
    { name: 'Slack', type: 'SLACK', status: 'ACTIVE', lastSyncAt: minsAgo(1) },
    { name: 'ServiceNow', type: 'SERVICENOW', status: 'INACTIVE' },
    { name: 'Twilio SMS', type: 'TWILIO', status: 'ACTIVE' },
    { name: 'MSG91', type: 'MSG91', status: 'INACTIVE' },
    { name: 'Email (SMTP)', type: 'EMAIL', status: 'ACTIVE' },
    { name: 'n8n Automation', type: 'N8N', status: 'ACTIVE' },
  ];

  for (const i of integrations) {
    await prisma.integration.create({ data: i });
  }
  console.log(`  ✓ ${integrations.length} integrations`);

  // ── On-Call Schedules ───────────────────────────────
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const onCalls = [
    { teamId: teams[0].id, userId: users[3].id, startTime: weekStart, endTime: weekEnd, isPrimary: true },
    { teamId: teams[1].id, userId: users[4].id, startTime: weekStart, endTime: weekEnd, isPrimary: true },
    { teamId: teams[2].id, userId: users[2].id, startTime: weekStart, endTime: weekEnd, isPrimary: true },
    { teamId: teams[3].id, userId: users[5].id, startTime: weekStart, endTime: weekEnd, isPrimary: true },
    { teamId: teams[4].id, userId: users[6].id, startTime: weekStart, endTime: weekEnd, isPrimary: true },
  ];

  for (const oc of onCalls) {
    await prisma.onCallSchedule.create({ data: oc });
  }
  console.log(`  ✓ ${onCalls.length} on-call schedules`);

  console.log('\n✅ Seed complete!');
  console.log(`   Login: rajkumar@santhira.com / ${PASSWORD}`);
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
