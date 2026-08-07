// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Alert Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { emitToAll } = require('../config/socket');
const { paginate, paginationMeta, success, error } = require('../utils/helpers');
const logger = require('../utils/logger');
const { resolveInstanceToConfigItem } = require('../utils/cmdbResolver');

// GET /api/v1/alerts
async function listAlerts(req, res, next) {
  try {
    const { status, severity, source, configItemId, search, sortBy, sortOrder } = req.query;
    const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);

    const where = {};
    Object.assign(where, req.tenantWhere);
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (source) where.source = source;
    if (configItemId) where.configItemId = configItemId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = sortBy ? { [sortBy]: sortOrder || 'desc' } : { firedAt: 'desc' };

    const [alerts, total] = await prisma.$transaction([
      prisma.alert.findMany({ where, include: { configItem: { select: { id: true, name: true, type: true } }, incident: { select: { id: true, number: true } }, organization: { select: { id: true, name: true, slug: true } } }, orderBy, skip, take }),
      prisma.alert.count({ where }),
    ]);

    return success(res, alerts, 200, paginationMeta(total, page, limit));
  } catch (err) { next(err); }
}

// GET /api/v1/alerts/:id
async function getAlert(req, res, next) {
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: req.params.id },
      include: { configItem: true, incident: { select: { id: true, number: true, shortDescription: true, state: true } } },
    });
    if (!alert) return error(res, 'Alert not found', 404);
    if (req.tenantWhere?.organizationId && alert.organizationId !== req.tenantWhere.organizationId) return error(res, 'Alert not found', 404);
    return success(res, alert);
  } catch (err) { next(err); }
}

// POST /api/v1/alerts/webhook (Prometheus/Grafana)
async function receiveWebhook(req, res, next) {
  try {
    const { alerts: incoming } = req.body;
    if (!Array.isArray(incoming)) return error(res, 'Invalid webhook payload', 400);

    const results = [];
    for (const a of incoming) {
      const alertId = a.labels?.alertname + ':' + (a.labels?.instance || a.fingerprint || Date.now());
      const existing = await prisma.alert.findUnique({ where: { alertId } });

      if (a.status === 'resolved' && existing) {
        await prisma.alert.update({ where: { id: existing.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
        emitToAll('alert:resolved', { id: existing.id, name: existing.name });
        results.push({ alertId, action: 'resolved' });
      } else if (!existing) {
        const configItemId = await resolveInstanceToConfigItem(a.labels?.instance);

        // Try to resolve org from Prometheus instance IP (strip port if present)
        let orgId = null;
        const rawInstance = a.labels?.instance || '';
        const instanceIp = rawInstance.split(':')[0];
        if (instanceIp) {
          const matchedOrg = await prisma.organization.findFirst({ where: { serverIp: instanceIp }, select: { id: true } });
          if (matchedOrg) orgId = matchedOrg.id;
        }

        const alert = await prisma.alert.create({
          data: {
            alertId, name: a.labels?.alertname || 'Unknown',
            severity: (a.labels?.severity || 'warning').toUpperCase() === 'CRITICAL' ? 'CRITICAL' : (a.labels?.severity || 'warning').toUpperCase() === 'WARNING' ? 'WARNING' : 'INFO',
            status: 'FIRING', source: 'PROMETHEUS',
            description: a.annotations?.description || a.annotations?.summary,
            metric: a.labels?.alertname,
            currentValue: a.annotations?.value || a.labels?.value,
            threshold: a.annotations?.threshold,
            labels: JSON.stringify(a.labels),
            annotations: JSON.stringify(a.annotations),
            firedAt: a.startsAt ? new Date(a.startsAt) : new Date(),
            ...(configItemId && { configItemId }),
            ...(orgId && { organizationId: orgId }),
          },
        });
        emitToAll('alert:fired', { id: alert.id, name: alert.name, severity: alert.severity });
        results.push({ alertId, action: 'created' });
      }
    }

    logger.info(`Webhook processed: ${results.length} alerts`);
    return success(res, { processed: results.length, results });
  } catch (err) { next(err); }
}

// POST /api/v1/alerts/:id/acknowledge
async function acknowledgeAlert(req, res, next) {
  try {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: req.user.id },
    });
    emitToAll('alert:acknowledged', { id: alert.id, name: alert.name });
    return success(res, alert);
  } catch (err) { next(err); }
}

// POST /api/v1/alerts/:id/silence
async function silenceAlert(req, res, next) {
  try {
    const durationMinutes = parseInt(req.body.duration, 10) || 60;
    const silenceUntil = new Date(Date.now() + durationMinutes * 60000);
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: { status: 'SILENCED', silenceUntil },
    });
    return success(res, alert);
  } catch (err) { next(err); }
}

// AI Knowledge Base for alert types — root cause, investigation, remediation
const ALERT_KB = {
  disk: {
    cat: 'Storage', rootCause: ['Filesystem usage exceeded threshold', 'Common: log accumulation, app data growth, temp files, backup rotation failure', 'K8s: container images and unused layers consume disk'],
    investigate: ['Check usage: `df -hT` — identify full mount point', 'Large files: `find / -type f -size +100M -exec ls -lh {} \\;`', 'Log dirs: `du -sh /var/log/*`', 'Container cleanup: `crictl rmi --prune`', 'Inode check: `df -i`'],
    remediate: ['Rotate logs: `logrotate -f /etc/logrotate.conf`', 'Clean cache: `apt clean` or `yum clean all`', 'Prune images: `crictl rmi --prune`', 'Expand filesystem or add disk if persistent', 'Set up automated cleanup cron'],
    escalation: 'If disk > 95% and growing, escalate to Infrastructure immediately', blast: 'High — full disk causes crashes, DB corruption, pod evictions',
  },
  cpu: {
    cat: 'Compute', rootCause: ['CPU utilization exceeded threshold', 'Common: app load spike, resource-intensive queries, runaway process', 'K8s: pods without resource limits cause contention'],
    investigate: ['Top processes: `top -bn1 -o %CPU | head -20`', 'Per-process: `ps aux --sort=-%cpu | head -15`', 'Load average: `uptime`', 'OOM check: `dmesg | grep -i oom`', 'K8s: `kubectl top pods -A --sort-by=cpu`'],
    remediate: ['Identify and restart runaway processes', 'Scale horizontally if app load', 'Set K8s resource requests/limits', 'Review recent deployments for regressions', 'Add CPU resources or migrate workloads'],
    escalation: 'If CPU > 95% sustained > 5 min, escalate to Application team', blast: 'Medium-High — causes latency, timeouts, SLA breaches',
  },
  memory: {
    cat: 'Compute', rootCause: ['Memory utilization crossed threshold', 'Common: memory leaks, JVM heap exhaustion, cache accumulation', 'Linux swapping degrades performance before OOM kills'],
    investigate: ['Memory: `free -h` — check available column', 'Swap: `swapon -s` and `vmstat 1 5`', 'Top consumers: `ps aux --sort=-%mem | head -15`', 'OOM events: `dmesg -T | grep -i oom`', 'Cgroup: `cat /sys/fs/cgroup/memory/memory.limit_in_bytes`'],
    remediate: ['Restart offending process', 'Clear caches: `sync; echo 3 > /proc/sys/vm/drop_caches`', 'JVM: review heap settings (-Xmx/-Xms)', 'K8s: adjust pod memory limits', 'Profile application for memory leaks'],
    escalation: 'If available memory < 5% and OOM kills occurring, escalate immediately', blast: 'High — OOM kills terminate services unpredictably',
  },
  icmp: {
    cat: 'Network', rootCause: ['Host not responding to ICMP probes', 'Common: host down, network path failure, firewall blocking, interface down', 'Multiple hosts affected = likely network/switch issue'],
    investigate: ['Ping from different segments', 'Check physical: link lights, cables, switch port', 'Out-of-band: iDRAC/iLO/IPMI check', 'Traceroute: `traceroute <host>`', 'Firewall: `iptables -L -n | grep icmp`'],
    remediate: ['Remote power-on via IPMI/iLO/iDRAC', 'Check/restart switch port, verify VLAN', 'Adjust firewall rules for ICMP', 'Physical inspection if OOB unreachable', 'Document outage for SLA reporting'],
    escalation: 'Immediate escalation to Network + Infrastructure teams', blast: 'Critical — all services on host affected',
  },
  switch: {
    cat: 'Network', rootCause: ['Switch ports reporting abnormal states', 'Common: link flapping, cable fault, speed/duplex mismatch, STP blocking', 'SNMP monitoring detected port state change'],
    investigate: ['Port status: `show interface status` (Cisco) / `display interface brief` (Huawei)', 'Errors: `show interface <port>` — CRC, collisions, drops', 'STP: `show spanning-tree interface <port>`', 'Port security: `show port-security interface <port>`', 'Review recent maintenance/changes'],
    remediate: ['Err-disabled: `shutdown` then `no shutdown`', 'Replace cable or SFP if fault', 'Review STP topology and root bridge', 'Check physical layer for persistent flapping', 'Enable error-disable recovery'],
    escalation: 'Escalate to Network team; invoke change management if critical links affected', blast: 'Medium — depends on affected port (host vs uplink)',
  },
  fortigate: {
    cat: 'Security', rootCause: ['FortiGate reporting config or firmware change', 'Version change may indicate upgrade, rollback, or unauthorized modification', 'Environmental alerts indicate hardware issues'],
    investigate: ['Firmware version: `get system status`', 'Config changes: `diagnose debug config-error-log read`', 'Event logs: `execute log display category event`', 'HA status: `diagnose sys ha status`', 'Hardware: `diagnose hardware test suite all`'],
    remediate: ['Unauthorized change: investigate, roll back firmware', 'Planned upgrade: verify policies and VPN tunnels', 'Temperature: check datacenter cooling', 'Backup config: `execute backup full-config`'],
    escalation: 'Escalate to Security/Firewall team; invoke security IR if unauthorized', blast: 'High — firewall affects all traffic through device',
  },
  login: {
    cat: 'Security', rootCause: ['SSH session count exceeded threshold', 'Common: brute-force attack, admin sessions, automated scripts', 'Critical threshold may indicate unauthorized access'],
    investigate: ['Active sessions: `who` or `w`', 'Auth logs: `tail -100 /var/log/auth.log`', 'Failed logins: `grep "Failed password" /var/log/auth.log`', 'Source IPs: `last -20`', 'SSH keys: `find /home -name authorized_keys -exec cat {} \\;`'],
    remediate: ['Block offending IPs via firewall/fail2ban', 'Close unused sessions', 'Harden SSH: key-only auth, disable root', 'Enable fail2ban', 'Review threshold sensitivity'],
    escalation: 'If critical threshold + unknown IPs, escalate to Security immediately', blast: 'Medium-Critical — depends on access achieved',
  },
  hostdown: {
    cat: 'Infrastructure', rootCause: ['Host completely unreachable — all probes failing', 'Common: power failure, kernel panic, network isolation, hypervisor crash', 'VM: host hypervisor may have failed'],
    investigate: ['IPMI check: `ipmitool -I lanplus chassis status`', 'Hypervisor: verify VM running', 'Datacenter: check PDU/UPS power', 'Switch: verify port is up', 'Check for ongoing maintenance'],
    remediate: ['Remote power on via IPMI', 'Force reboot: `ipmitool chassis power cycle`', 'VM: restart from hypervisor', 'Hardware failure: engage vendor RMA', 'Activate DR/failover if production'],
    escalation: 'P1 — escalate to Infrastructure + Application immediately', blast: 'Critical — all services on host affected',
  },
  // ── Kubernetes Layer ────────────────────────
  kubePodCrash: {
    cat: 'Kubernetes', rootCause: ['Pod repeatedly crashing and restarting (CrashLoopBackOff)', 'Common: application error, missing config/secret, OOM kill, failed health probe', 'Container exits with non-zero code triggering kubelet restart backoff'],
    investigate: ['Pod logs: `kubectl logs <pod> -n <ns> --previous`', 'Describe: `kubectl describe pod <pod> -n <ns>` — check Events', 'Exit code: `kubectl get pod <pod> -n <ns> -o jsonpath="{.status.containerStatuses[*].lastState}"`', 'OOM: `kubectl get events -n <ns> --field-selector reason=OOMKilling`', 'Config: verify ConfigMaps, Secrets, env vars'],
    remediate: ['Fix application error from logs', 'Increase memory limits if OOM killed', 'Fix health probe (liveness/readiness) if misconfigured', 'Roll back deployment: `kubectl rollout undo deployment/<name>`', 'Check dependent services (DB, cache) availability'],
    escalation: 'If production pod, escalate to Application team immediately', blast: 'Medium — affects single service, may cascade if dependency',
  },
  kubePodOOM: {
    cat: 'Kubernetes', rootCause: ['Container exceeded memory limit — OOM killed by kernel', 'Common: memory leak, unbounded cache, large request processing', 'K8s cgroup enforces memory.limit_in_bytes, kernel kills on exceed'],
    investigate: ['Events: `kubectl get events -n <ns> --field-selector reason=OOMKilling`', 'Resource usage: `kubectl top pod <pod> -n <ns>`', 'Limits: `kubectl get pod <pod> -n <ns> -o jsonpath="{.spec.containers[*].resources}"`', 'Application profiling for memory leaks', 'Check recent deployments for regression'],
    remediate: ['Increase memory limits in deployment spec', 'Profile and fix memory leak in application', 'Add JVM heap limits (-Xmx) if Java', 'Implement pagination for large data processing', 'Consider HPA with memory-based scaling'],
    escalation: 'Escalate to Application team; increase limits as temporary mitigation', blast: 'Medium — service restart causes brief outage',
  },
  kubePodNotReady: {
    cat: 'Kubernetes', rootCause: ['Pod exists but readiness probe failing — removed from service endpoints', 'Common: dependency unavailable, slow startup, misconfigured probe', 'Traffic stops routing to pod while it remains running'],
    investigate: ['Describe: `kubectl describe pod <pod> -n <ns>` — check readiness probe', 'Probe endpoint: curl the readiness path manually', 'Dependencies: check DB/cache/external service connectivity', 'Resource pressure: `kubectl top pod <pod> -n <ns>`', 'Network policies: verify ingress/egress rules'],
    remediate: ['Fix underlying dependency issue', 'Adjust readiness probe thresholds (initialDelaySeconds, periodSeconds)', 'Restart pod: `kubectl delete pod <pod> -n <ns>`', 'Scale up replicas for resilience', 'Add startup probe for slow-starting apps'],
    escalation: 'If > 50% pods not ready, escalate immediately', blast: 'Medium — reduced capacity, potential service degradation',
  },
  kubeNodeNotReady: {
    cat: 'Kubernetes', rootCause: ['Node reporting NotReady — kubelet lost contact with API server', 'Common: kubelet crash, resource exhaustion (disk/memory pressure), network partition', 'All pods on node may be evicted after grace period'],
    investigate: ['Node status: `kubectl describe node <node>` — check Conditions', 'Kubelet: `systemctl status kubelet` on node', 'System resources: `top`, `df -h`, `free -h` on node', 'Network: verify node-to-API-server connectivity', 'Docker/containerd: `systemctl status containerd`'],
    remediate: ['Restart kubelet: `systemctl restart kubelet`', 'Free disk space if DiskPressure', 'Free memory if MemoryPressure', 'Restart containerd: `systemctl restart containerd`', 'Drain and cordon if hardware issue: `kubectl drain <node>`'],
    escalation: 'P1 — all pods on node affected; escalate to Infrastructure immediately', blast: 'Critical — entire node workload affected, pod rescheduling may cascade',
  },
  kubeDeploymentMismatch: {
    cat: 'Kubernetes', rootCause: ['Deployment has fewer ready replicas than desired', 'Common: insufficient cluster resources, pod scheduling failure, image pull error', 'Pending pods stuck waiting for CPU/memory/node affinity'],
    investigate: ['Deployment: `kubectl describe deployment <name> -n <ns>`', 'Pending pods: `kubectl get pods -n <ns> --field-selector status.phase=Pending`', 'Events: `kubectl get events -n <ns> --sort-by=lastTimestamp`', 'Node resources: `kubectl describe nodes | grep -A5 Allocated`', 'Image pull: check registry access and image tag'],
    remediate: ['Fix image pull errors (tag, registry auth)', 'Scale up nodes or add resource capacity', 'Adjust resource requests to fit available capacity', 'Remove node affinity constraints if too restrictive', 'Manual scale: `kubectl scale deployment/<name> --replicas=<n>`'],
    escalation: 'If production deployment under-scaled, escalate to Platform team', blast: 'Medium-High — reduced service capacity',
  },
  kubeHPA: {
    cat: 'Kubernetes', rootCause: ['HPA at maximum replicas — cannot scale further', 'Application load exceeds cluster auto-scaling capacity', 'May indicate sustained traffic spike or resource leak'],
    investigate: ['HPA status: `kubectl describe hpa <name> -n <ns>`', 'Current vs desired: `kubectl get hpa -n <ns>`', 'Pod metrics: `kubectl top pods -n <ns> --sort-by=cpu`', 'Traffic patterns: check ingress logs for spike', 'Cluster capacity: `kubectl describe nodes | grep -A5 Allocated`'],
    remediate: ['Increase HPA maxReplicas', 'Add cluster nodes for capacity', 'Optimize application resource usage', 'Implement request rate limiting', 'Review and tune HPA target metrics'],
    escalation: 'If at max replicas + high latency, escalate to Platform + Application', blast: 'Medium — service running but at capacity ceiling',
  },
  // ── Application Layer ──────────────────────
  appError: {
    cat: 'Application', rootCause: ['Application returning HTTP 5xx errors at elevated rate', 'Common: unhandled exception, DB connection failure, dependency timeout', 'May indicate deployment regression or infrastructure issue'],
    investigate: ['Application logs: check for stack traces and error patterns', 'Error rate trend: compare with recent deployment timeline', 'DB connectivity: `pg_isready -h <host>` or connection pool status', 'Dependency health: check upstream services', 'Resource usage: CPU/memory of application pods'],
    remediate: ['Roll back if error coincides with deployment', 'Restart application pods if transient', 'Fix DB connection pool exhaustion', 'Add circuit breaker for failing dependencies', 'Scale up if resource constrained'],
    escalation: 'If error rate > 5%, escalate to Application team immediately', blast: 'High — user-facing errors, SLA impact',
  },
  dbConnection: {
    cat: 'Database', rootCause: ['Database connection failures detected', 'Common: DB overloaded, max_connections reached, network issue, auth failure', 'Connection pool exhaustion causes cascading application failures'],
    investigate: ['DB status: `pg_isready` or `mysqladmin ping`', 'Connections: `SELECT count(*) FROM pg_stat_activity;`', 'Max connections: `SHOW max_connections;`', 'Network: verify DB port reachable from app', 'Slow queries: `SELECT * FROM pg_stat_activity WHERE state = \'active\';`'],
    remediate: ['Kill idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = \'idle\';`', 'Increase max_connections if justified', 'Tune connection pool (min/max/idle timeout)', 'Restart DB if unresponsive', 'Failover to replica if primary down'],
    escalation: 'P1 — database failure affects all dependent services', blast: 'Critical — all application services using this DB',
  },
  certificate: {
    cat: 'Security', rootCause: ['TLS/SSL certificate approaching expiry or already expired', 'Common: missed renewal, cert-manager failure, manual cert not rotated', 'Expired cert causes service outage for HTTPS endpoints'],
    investigate: ['Check expiry: `openssl s_client -connect <host>:443 2>/dev/null | openssl x509 -noout -dates`', 'cert-manager: `kubectl get certificates -A`', 'Renewal logs: `kubectl logs -n cert-manager deploy/cert-manager`', 'ACME/Let\'s Encrypt: check rate limits and DNS validation'],
    remediate: ['Force renewal: `kubectl delete secret <tls-secret> -n <ns>`', 'Manual cert: obtain and apply new certificate', 'Fix cert-manager issuer configuration', 'Set up cert expiry monitoring alert at 30d/7d/1d', 'Implement auto-renewal with cert-manager'],
    escalation: 'If < 7 days to expiry on production cert, escalate immediately', blast: 'High — HTTPS service outage when expired',
  },
};

function getAlertKB(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('disk') || n.includes('filesystem')) return ALERT_KB.disk;
  if (n.includes('cpu') || n.includes('load')) return ALERT_KB.cpu;
  if (n.includes('mem') && !n.includes('deploy')) return ALERT_KB.memory;
  if (n.includes('icmp') || n.includes('ping') || n.includes('blackbox')) return ALERT_KB.icmp;
  if (n.includes('switch') || n.includes('snmp') || n.includes('huawei') || n.includes('ifoper') || (n.includes('enabled') && n.includes('down'))) return ALERT_KB.switch;
  if (n.includes('fortigate') || n.includes('firewall')) return ALERT_KB.fortigate;
  if (n.includes('login') || n.includes('ssh')) return ALERT_KB.login;
  if (n.includes('hostdown') || n.includes('host_down')) return ALERT_KB.hostdown;
  if (n.includes('nodedisk') || (n.includes('node') && n.includes('pressure'))) return ALERT_KB.disk;
  // Kubernetes layer
  if (n.includes('crashloop') || n.includes('crash_loop') || n.includes('podcrash')) return ALERT_KB.kubePodCrash;
  if (n.includes('oomkill') || n.includes('oom') || n.includes('outofmemory')) return ALERT_KB.kubePodOOM;
  if (n.includes('podnotready') || n.includes('pod_not_ready') || (n.includes('pod') && n.includes('notready'))) return ALERT_KB.kubePodNotReady;
  if (n.includes('nodenotready') || n.includes('node_not_ready') || (n.includes('node') && n.includes('notready'))) return ALERT_KB.kubeNodeNotReady;
  if (n.includes('replicasmismatch') || n.includes('replicas_mismatch') || n.includes('deploymentmismatch')) return ALERT_KB.kubeDeploymentMismatch;
  if (n.includes('hpamaxreplicas') || n.includes('hpa') || n.includes('autoscal')) return ALERT_KB.kubeHPA;
  // Application layer
  if (n.includes('500') || n.includes('5xx') || n.includes('django') || n.includes('exception') || n.includes('apperror')) return ALERT_KB.appError;
  if (n.includes('dbconnect') || n.includes('db_connect') || n.includes('database') || n.includes('postgres') || n.includes('mysql') || n.includes('connection_fail')) return ALERT_KB.dbConnection;
  if (n.includes('certif') || n.includes('ssl') || n.includes('tls') || n.includes('expir')) return ALERT_KB.certificate;
  return null;
}

// Parse DiskVolumes_list or stats JSON from annotations
function parseDiskVolumes(annotations) {
  let diskList = null;
  try {
    const raw = annotations.DiskVolumes_list || annotations.diskvolumes_list || annotations.disk_volumes;
    if (raw) diskList = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) { logger.warn('Failed to parse disk volumes: %s', e.message); }
  return diskList;
}

// POST /api/v1/alerts/:id/create-incident
async function createIncidentFromAlert(req, res, next) {
  try {
    const alert = await prisma.alert.findUnique({ where: { id: req.params.id }, include: { configItem: true, organization: true } });
    if (!alert) return error(res, 'Alert not found', 404);

    let labels = {};
    let annotations = {};
    try { labels = JSON.parse(alert.labels || '{}'); } catch (e) { logger.warn('Failed to parse alert labels: %s', e.message); }
    try { annotations = JSON.parse(alert.annotations || '{}'); } catch (e) { logger.warn('Failed to parse alert annotations: %s', e.message); }

    // Extract identifiers
    const instance = labels.instance || labels.target || '';
    const ip = instance.split(':')[0] || labels.ip || labels.node_ip || '';
    const hostname = labels.hostname || labels.nodename || labels.node || labels.host || labels.exported_instance || '';
    const job = labels.job || labels.scrape_job || '';
    const namespace = labels.namespace || '';
    const pod = labels.pod || labels.pod_name || '';
    const container = labels.container || '';
    const service = labels.service || labels.service_name || '';
    const orgName = alert.organization?.name || '';
    const orgEnv = alert.organization?.environment || '';

    // Resolve asset from CMDB for extra details
    let asset = null;
    if (ip && alert.organizationId) {
      asset = await prisma.configurationItem.findFirst({
        where: { organizationId: alert.organizationId, ipAddress: { contains: ip } },
        select: { name: true, hostname: true, type: true, os: true, osVersion: true, manufacturer: true, model: true, category: true },
      });
    }
    const resolvedHostname = asset?.hostname || asset?.name || hostname;

    // Short description: [SEVERITY] AlertName on hostname (IP)
    const sevLabel = alert.severity || 'WARNING';
    let shortDescription = `[${sevLabel}] ${alert.name}`;
    if (resolvedHostname) {
      shortDescription += ` on ${resolvedHostname}`;
      if (ip && ip !== resolvedHostname) shortDescription += ` (${ip})`;
    } else if (ip) {
      shortDescription += ` on ${ip}`;
    }

    // Build AI-quality structured description
    const kb = getAlertKB(alert.name);
    const d = [];

    d.push(`ALERT: ${alert.name}`);
    d.push(`Severity: ${sevLabel}`);
    if (kb) d.push(`Category: ${kb.cat}`);
    d.push('');

    // ── Affected System
    d.push('── Affected System ─────────────────');
    if (orgName) d.push(`Client: ${orgName}${orgEnv ? ` (${orgEnv})` : ''}`);
    if (resolvedHostname) d.push(`Hostname: ${resolvedHostname}`);
    if (ip) d.push(`IP Address: ${ip}`);
    if (asset) {
      if (asset.type) d.push(`Asset Type: ${asset.type}${asset.type === 'VM' ? ' (Virtual Machine)' : asset.type === 'SERVER' ? ' (Physical)' : ''}`);
      if (asset.os) d.push(`Operating System: ${asset.os}${asset.osVersion ? ' ' + asset.osVersion.substring(0, 40) : ''}`);
      if (asset.manufacturer) d.push(`Hardware: ${asset.manufacturer}${asset.model ? ' ' + asset.model : ''}`);
    }
    if (job) d.push(`Job: ${job}`);
    if (namespace) d.push(`Namespace: ${namespace}`);
    if (pod) d.push(`Pod: ${pod}`);
    if (container) d.push(`Container: ${container}`);
    if (service) d.push(`Service: ${service}`);
    d.push(`Fired At: ${alert.firedAt?.toISOString() || 'N/A'}`);
    d.push('');

    // ── Alert Details with actual metric data
    d.push('── Alert Details ───────────────────');
    if (annotations.ENS_message || annotations.ens_message) d.push(`Message: ${annotations.ENS_message || annotations.ens_message}`);
    else if (annotations.summary) d.push(`Summary: ${annotations.summary}`);
    if (annotations.description && annotations.description !== (annotations.summary || '')) d.push(`Description: ${annotations.description}`);
    if (alert.metric) d.push(`Metric: ${alert.metric}`);
    if (alert.currentValue && String(alert.currentValue).length > 1) d.push(`Current Value: ${alert.currentValue}`);
    if (alert.threshold) d.push(`Threshold: ${alert.threshold}`);
    if (annotations.runbook_url) d.push(`Runbook: ${annotations.runbook_url}`);

    // Parse disk volumes if available
    const diskVolumes = parseDiskVolumes(annotations);
    if (diskVolumes) {
      d.push('');
      d.push('── Disk Volumes ────────────────────');
      for (const [mount, info] of Object.entries(diskVolumes)) {
        const pct = typeof info === 'object' ? info.percentage : info;
        const status = typeof info === 'object' && info.status === 1 ? 'WARNING' : typeof info === 'object' && info.status === 0 ? 'CRITICAL' : 'OK';
        const bar = Number(pct) >= 75 ? '▓▓▓▓▓▓▓░░░' : Number(pct) >= 50 ? '▓▓▓▓▓░░░░░' : '▓▓░░░░░░░░';
        d.push(`/${mount}: ${pct}% ${bar} [${status}]`);
      }
    }
    d.push('');

    // ── Root Cause Analysis (from KB)
    if (kb) {
      d.push('── Root Cause Analysis ─────────────');
      kb.rootCause.forEach(r => d.push(`- ${r}`));
      d.push('');

      d.push('── Investigation Steps ─────────────');
      kb.investigate.forEach((s, i) => d.push(`${i + 1}. ${s}`));
      d.push('');

      d.push('── Recommended Actions ─────────────');
      kb.remediate.forEach((s, i) => d.push(`${i + 1}. ${s}`));
      d.push('');

      d.push('── Impact Assessment ───────────────');
      d.push(`Blast Radius: ${kb.blast}`);
      d.push(`Escalation: ${kb.escalation}`);
    }

    // ── Source
    d.push('');
    d.push('── Source ──────────────────────────');
    d.push(`Alert ID: ${alert.alertId}`);
    d.push(`Source: ${alert.source}`);
    d.push(`Fired At: ${alert.firedAt?.toISOString() || 'N/A'}`);
    if (alert.configItem) d.push(`Config Item: ${alert.configItem.name} (${alert.configItem.type})`);

    // Relevant metadata labels (filtered)
    const noiseLabels = new Set([
      '__name__', 'le_code', 'isEvent', 'product_model', 'fortigatealert',
      'mode', 'alertname', 'severity', 'instance', 'job', 'hostname',
      'nodename', 'node', 'host', 'exported_instance', 'target',
      'ip', 'node_ip', 'namespace', 'pod', 'pod_name', 'container',
      'service', 'service_name', 'scrape_job', 'monitor_status', 'title',
      'ENS_message', 'ens_message', 'DiskVolumes_list', 'diskvolumes_list',
      'stats', 'statsTitle', 'datetime', 'description', 'summary',
      // Huawei/SNMP noise labels
      'huaweitb', 'huaweitbalert', 'ifDescr', 'ifName', 'ifAlias',
      'ifindex', 'ifIndex', 'ifType', 'ifOperStatus', 'ifAdminStatus',
      'snmp_host', 'oid', 'community', 'snmpVersion', 'snmp_target',
      // Generic noise
      'subject', 'value', 'threshold', 'runbook_url', 'grafana_folder',
      'org_slug', 'organization', 'client', 'group', 'groupname',
    ]);
    const metaEntries = Object.entries(labels).filter(([k, v]) => !noiseLabels.has(k) && String(v).length > 1);
    if (metaEntries.length > 0) {
      d.push('');
      d.push('── Alert Metadata ─────────────────');
      for (const [k, v] of metaEntries) d.push(`${k}: ${v}`);
    }

    req.body = {
      shortDescription: shortDescription.substring(0, 200),
      description: d.join('\n'),
      impact: alert.severity === 'CRITICAL' ? 'ENTERPRISE' : 'TEAM',
      urgency: alert.severity === 'CRITICAL' ? 'CRITICAL' : alert.severity === 'WARNING' ? 'HIGH' : 'MEDIUM',
      source: 'PROMETHEUS',
      sourceAlertId: alert.alertId,
      sourceAlertName: alert.name,
      configItemId: alert.configItemId,
    };

    const incidentController = require('./incident.controller');
    return incidentController.createIncident(req, res, next);
  } catch (err) { next(err); }
}

// GET /api/v1/alerts/stats
async function getAlertStats(req, res, next) {
  try {
    const tw = req.tenantWhere || {};
    const [bySeverity, byStatus, total, firing] = await prisma.$transaction([
      prisma.alert.groupBy({ by: ['severity'], where: { ...tw }, _count: true }),
      prisma.alert.groupBy({ by: ['status'], where: { ...tw }, _count: true }),
      prisma.alert.count({ where: { ...tw } }),
      prisma.alert.count({ where: { ...tw, status: 'FIRING' } }),
    ]);

    return success(res, { total, firing, bySeverity, byStatus });
  } catch (err) { next(err); }
}

// ── Incident Auto-Classification from Alert KB ─────────────
// Maps ALERT_KB categories to ITIL incident categories
const KB_CAT_TO_CATEGORY = {
  'Storage': 'Hardware', 'Compute': 'Hardware', 'Network': 'Network',
  'Security': 'Security', 'Infrastructure': 'Cloud Infrastructure',
  'Kubernetes': 'Cloud Infrastructure', 'Application': 'Application',
  'Database': 'Database',
};

function classifyCategory(alertName) {
  const kb = getAlertKB(alertName);
  if (!kb || !kb.cat) return 'Monitoring';
  return KB_CAT_TO_CATEGORY[kb.cat] || 'Other';
}

function classifySubcategory(alertName) {
  const kb = getAlertKB(alertName);
  if (!kb) return null;
  const n = (alertName || '').toLowerCase();
  switch (kb.cat) {
    case 'Storage': return n.includes('inode') ? 'Inode Exhaustion' : 'Disk / Filesystem';
    case 'Compute': return n.includes('cpu') || n.includes('load') ? 'CPU' : 'Memory';
    case 'Network': return n.includes('switch') || n.includes('snmp') ? 'Switch / Port' : 'Connectivity';
    case 'Security':
      if (n.includes('certif') || n.includes('ssl') || n.includes('tls')) return 'Certificate';
      if (n.includes('firewall') || n.includes('fortigate')) return 'Firewall';
      return 'Access / Login';
    case 'Infrastructure': return n.includes('host') ? 'Host Down' : 'Node';
    case 'Kubernetes':
      if (n.includes('pod')) return 'Pod';
      if (n.includes('node')) return 'Node';
      if (n.includes('deploy') || n.includes('hpa')) return 'Deployment';
      return 'Cluster';
    case 'Application': return n.includes('5xx') || n.includes('500') ? 'HTTP Error' : 'Runtime Error';
    case 'Database': return 'Connectivity';
    default: return null;
  }
}

// Shared: Build AI-quality description for an alert → incident
// Used by both createIncidentFromAlert and webhook auto-creation
async function buildIncidentFromAlert(alert) {
  let labels = {};
  let annotations = {};
  try { labels = JSON.parse(alert.labels || '{}'); } catch (e) { logger.warn('Failed to parse alert labels: %s', e.message); }
  try { annotations = JSON.parse(alert.annotations || '{}'); } catch (e) { logger.warn('Failed to parse alert annotations: %s', e.message); }

  const instance = labels.instance || labels.target || '';
  const ip = instance.split(':')[0] || labels.ip || labels.node_ip || '';
  const hostname = labels.hostname || labels.nodename || labels.node || labels.host || labels.exported_instance || '';
  const job = labels.job || labels.scrape_job || '';
  const namespace = labels.namespace || '';
  const pod = labels.pod || labels.pod_name || '';
  const container = labels.container || '';
  const service = labels.service || labels.service_name || '';

  // Resolve org
  let org = null;
  if (alert.organizationId) {
    org = await prisma.organization.findUnique({ where: { id: alert.organizationId }, select: { name: true, environment: true } });
  }

  // Resolve CMDB asset
  let asset = null;
  if (ip && alert.organizationId) {
    asset = await prisma.configurationItem.findFirst({
      where: { organizationId: alert.organizationId, ipAddress: { contains: ip } },
      select: { name: true, hostname: true, type: true, os: true, osVersion: true, manufacturer: true, model: true },
    });
  }
  const resolvedHostname = asset?.hostname || asset?.name || hostname;

  // Short description
  const sevLabel = alert.severity || 'WARNING';
  let shortDescription = `[${sevLabel}] ${alert.name}`;
  if (resolvedHostname) {
    shortDescription += ` on ${resolvedHostname}`;
    if (ip && ip !== resolvedHostname) shortDescription += ` (${ip})`;
  } else if (ip) {
    shortDescription += ` on ${ip}`;
  }

  // Build structured description
  const kb = getAlertKB(alert.name);
  const d = [];
  d.push(`ALERT: ${alert.name}`);
  d.push(`Severity: ${sevLabel}`);
  if (kb) d.push(`Category: ${kb.cat}`);
  d.push('');

  d.push('── Affected System ─────────────────');
  if (org) d.push(`Client: ${org.name}${org.environment ? ` (${org.environment})` : ''}`);
  if (resolvedHostname) d.push(`Hostname: ${resolvedHostname}`);
  if (ip) d.push(`IP Address: ${ip}`);
  if (asset) {
    if (asset.type) d.push(`Asset Type: ${asset.type}${asset.type === 'VM' ? ' (Virtual Machine)' : asset.type === 'SERVER' ? ' (Physical)' : ''}`);
    if (asset.os) d.push(`Operating System: ${asset.os}${asset.osVersion ? ' ' + asset.osVersion.substring(0, 40) : ''}`);
    if (asset.manufacturer) d.push(`Hardware: ${asset.manufacturer}${asset.model ? ' ' + asset.model : ''}`);
  }
  if (job) d.push(`Job: ${job}`);
  if (namespace) d.push(`Namespace: ${namespace}`);
  if (pod) d.push(`Pod: ${pod}`);
  if (container) d.push(`Container: ${container}`);
  if (service) d.push(`Service: ${service}`);
  d.push(`Fired At: ${alert.firedAt?.toISOString() || 'N/A'}`);
  const mins = alert.firedAt ? Math.round((Date.now() - new Date(alert.firedAt).getTime()) / 60000) : 0;
  if (mins > 0) d.push(`Duration: ${mins > 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + ' min'} (active)`);
  d.push('');

  d.push('── Alert Details ───────────────────');
  const subject = labels.subject || annotations.subject || annotations.ENS_message || annotations.ens_message || '';
  const summary = annotations.summary || '';
  const description = annotations.description || '';
  if (subject) d.push(`Message: ${subject}`);
  else if (summary) d.push(`Summary: ${summary}`);
  if (description && description !== subject && description !== summary) d.push(`Description: ${description}`);
  if (alert.metric) d.push(`Metric: ${alert.metric}`);
  if (alert.currentValue && String(alert.currentValue).length > 1) d.push(`Current Value: ${alert.currentValue}`);
  if (alert.threshold) d.push(`Threshold: ${alert.threshold}`);
  if (annotations.runbook_url) d.push(`Runbook: ${annotations.runbook_url}`);
  // Disk-specific
  if (labels.device) d.push(`Device: ${labels.device}`);
  if (labels.fstype) d.push(`Filesystem: ${labels.fstype}`);
  if (labels.diskwarning) d.push(`Warning Threshold: ${labels.diskwarning}%`);
  if (labels.diskcritical) d.push(`Critical Threshold: ${labels.diskcritical}%`);
  // FortiGate-specific
  if (labels.fgSysVersion) d.push(`FortiGate Version: ${labels.fgSysVersion}`);
  // SNMP/Switch-specific
  if (labels.ifName) d.push(`Interface: ${labels.ifName}`);
  if (labels.ifDescr && labels.ifDescr !== labels.ifName) d.push(`Port Description: ${labels.ifDescr}`);
  if (labels.ifAlias) d.push(`Port Alias: ${labels.ifAlias}`);

  // Parse disk volumes
  const diskVolumes = parseDiskVolumes(annotations);
  if (diskVolumes) {
    d.push('');
    d.push('── Disk Volumes ────────────────────');
    for (const [mount, info] of Object.entries(diskVolumes)) {
      const pct = typeof info === 'object' ? info.percentage : info;
      const status = typeof info === 'object' && info.status === 1 ? 'WARNING' : typeof info === 'object' && info.status === 0 ? 'CRITICAL' : 'OK';
      const bar = Number(pct) >= 75 ? '▓▓▓▓▓▓▓░░░' : Number(pct) >= 50 ? '▓▓▓▓▓░░░░░' : '▓▓░░░░░░░░';
      d.push(`/${mount}: ${pct}% ${bar} [${status}]`);
    }
  }

  // ── Live Prometheus metrics enrichment (full system snapshot) ──
  try {
    if (alert.organizationId && ip) {
      const aiController = require('./aiAgent.controller');
      const resolvePrometheusAccess = aiController.resolvePrometheusAccess;
      const executePromQueries = aiController.executePromQueries;
      if (resolvePrometheusAccess && executePromQueries) {
        const access = await resolvePrometheusAccess(alert.organizationId);
        if (access.method !== 'local') {
          const target = ip.includes(':') ? ip : `${ip}:9100`;
          const liveQueries = {
            // System
            cpuUsage: `100 - (avg by (instance)(irate(node_cpu_seconds_total{mode="idle",instance=~"${target}"}[5m])) * 100)`,
            cpuCount: `count(node_cpu_seconds_total{mode="idle",instance=~"${target}"})`,
            load1: `node_load1{instance=~"${target}"}`,
            load5: `node_load5{instance=~"${target}"}`,
            load15: `node_load15{instance=~"${target}"}`,
            memTotal: `node_memory_MemTotal_bytes{instance=~"${target}"}`,
            memAvail: `node_memory_MemAvailable_bytes{instance=~"${target}"}`,
            swapTotal: `node_memory_SwapTotal_bytes{instance=~"${target}"}`,
            swapFree: `node_memory_SwapFree_bytes{instance=~"${target}"}`,
            // Disk
            fsSize: `node_filesystem_size_bytes{instance=~"${target}",fstype!~"tmpfs|devtmpfs|overlay|squashfs"}`,
            fsAvail: `node_filesystem_avail_bytes{instance=~"${target}",fstype!~"tmpfs|devtmpfs|overlay|squashfs"}`,
            diskIOPS: `rate(node_disk_reads_completed_total{instance=~"${target}"}[5m]) + rate(node_disk_writes_completed_total{instance=~"${target}"}[5m])`,
            // Network
            netInterfaces: `node_network_info{instance=~"${target}"}`,
            netRxRate: `rate(node_network_receive_bytes_total{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}[5m])`,
            netTxRate: `rate(node_network_transmit_bytes_total{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}[5m])`,
            netRxErrors: `node_network_receive_errs_total{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}`,
            netTxErrors: `node_network_transmit_errs_total{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}`,
            netOperState: `node_network_carrier{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}`,
            netRxTotal: `node_network_receive_bytes_total{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}`,
            netTxTotal: `node_network_transmit_bytes_total{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}`,
            // Virtualization
            vmInfo: `node_dmi_info{instance=~"${target}"}`,
            uname: `node_uname_info{instance=~"${target}"}`,
            bootTime: `node_boot_time_seconds{instance=~"${target}"}`,
          };
          const liveData = await executePromQueries(access, liveQueries);

          const pv = (key) => parseFloat(liveData[key]?.result?.[0]?.value?.[1] || '0');
          const fmtBytes = (b) => { const n = Number(b); if (n > 1e9) return (n/1e9).toFixed(2)+' GB'; if (n > 1e6) return (n/1e6).toFixed(2)+' MB'; if (n > 1e3) return (n/1e3).toFixed(2)+' KB'; return n.toFixed(0)+' B'; };
          const fmtRate = (b) => fmtBytes(b) + '/s';

          // System snapshot
          const cpuPct = pv('cpuUsage');
          const cpuCores = Math.round(pv('cpuCount'));
          const memTotalB = pv('memTotal');
          const memAvailB = pv('memAvail');
          const memPct = memTotalB > 0 ? ((1 - memAvailB / memTotalB) * 100) : 0;
          const swapTotalB = pv('swapTotal');
          const swapUsedB = swapTotalB - pv('swapFree');
          const bootTs = pv('bootTime');
          const uptimeDays = bootTs > 0 ? ((Date.now() / 1000 - bootTs) / 86400).toFixed(1) : 'N/A';
          const unameInfo = liveData.uname?.result?.[0]?.metric || {};

          if (cpuCores > 0 || memTotalB > 0) {
            d.push('');
            d.push('── Live System Metrics ─────────────');
            if (unameInfo.sysname) d.push(`OS: ${unameInfo.sysname} ${unameInfo.release || ''} ${unameInfo.machine || ''}`);
            d.push(`Uptime: ${uptimeDays} days`);
            const cpuBar = cpuPct > 90 ? '▓▓▓▓▓▓▓▓▓░' : cpuPct > 75 ? '▓▓▓▓▓▓▓░░░' : cpuPct > 50 ? '▓▓▓▓▓░░░░░' : '▓▓▓░░░░░░░';
            d.push(`CPU: ${cpuPct.toFixed(1)}% ${cpuBar} (${cpuCores} cores)`);
            d.push(`Load: ${pv('load1').toFixed(2)} / ${pv('load5').toFixed(2)} / ${pv('load15').toFixed(2)}`);
            const memBar = memPct > 90 ? '▓▓▓▓▓▓▓▓▓░' : memPct > 75 ? '▓▓▓▓▓▓▓░░░' : memPct > 50 ? '▓▓▓▓▓░░░░░' : '▓▓▓░░░░░░░';
            d.push(`Memory: ${memPct.toFixed(1)}% ${memBar} (${fmtBytes(memTotalB - memAvailB)} / ${fmtBytes(memTotalB)})`);
            if (swapTotalB > 0) d.push(`Swap: ${fmtBytes(swapUsedB)} / ${fmtBytes(swapTotalB)}`);
          }

          // Filesystem snapshot
          const fsSizeResults = liveData.fsSize?.result || [];
          const fsAvailResults = liveData.fsAvail?.result || [];
          if (fsSizeResults.length > 0) {
            const fsMap = {};
            for (const r of fsSizeResults) {
              const mp = r.metric?.mountpoint || '/';
              fsMap[mp] = { total: parseFloat(r.value?.[1] || '0'), device: r.metric?.device || '', fstype: r.metric?.fstype || '' };
            }
            for (const r of fsAvailResults) {
              const mp = r.metric?.mountpoint || '/';
              if (fsMap[mp]) fsMap[mp].avail = parseFloat(r.value?.[1] || '0');
            }
            d.push('');
            d.push('── Disk Usage ─────────────────────');
            for (const [mp, fs] of Object.entries(fsMap)) {
              const used = fs.total - (fs.avail || 0);
              const pct = fs.total > 0 ? (used / fs.total * 100) : 0;
              const bar = pct > 90 ? '▓▓▓▓▓▓▓▓▓░' : pct > 75 ? '▓▓▓▓▓▓▓░░░' : pct > 50 ? '▓▓▓▓▓░░░░░' : '▓▓▓░░░░░░░';
              d.push(`${mp}: ${pct.toFixed(1)}% ${bar} (${fmtBytes(used)} / ${fmtBytes(fs.total)}) [${fs.fstype}]`);
            }
            const iops = pv('diskIOPS');
            if (iops > 0) d.push(`Disk IOPS: ${iops.toFixed(1)}`);
          }

          // Network Interfaces section
          const ifInfo = liveData.netInterfaces?.result || [];
          const rxRates = liveData.netRxRate?.result || [];
          const txRates = liveData.netTxRate?.result || [];
          const rxErrors = liveData.netRxErrors?.result || [];
          const txErrors = liveData.netTxErrors?.result || [];
          const operState = liveData.netOperState?.result || [];
          const rxTotals = liveData.netRxTotal?.result || [];
          const txTotals = liveData.netTxTotal?.result || [];

          const devices = new Map();
          for (const r of ifInfo) {
            const dev = r.metric?.device;
            if (!dev) continue;
            devices.set(dev, { operstate: r.metric?.operstate || 'unknown', address: r.metric?.address || '' });
          }
          for (const r of operState) { const dev = r.metric?.device; if (dev && devices.has(dev)) devices.get(dev).carrier = r.value?.[1] === '1' ? 'up' : 'down'; }
          for (const r of rxRates) { const dev = r.metric?.device; if (dev && devices.has(dev)) devices.get(dev).rxRate = Number(r.value?.[1] || 0); }
          for (const r of txRates) { const dev = r.metric?.device; if (dev && devices.has(dev)) devices.get(dev).txRate = Number(r.value?.[1] || 0); }
          for (const r of rxErrors) { const dev = r.metric?.device; if (dev && devices.has(dev)) devices.get(dev).rxErrors = Number(r.value?.[1] || 0); }
          for (const r of txErrors) { const dev = r.metric?.device; if (dev && devices.has(dev)) devices.get(dev).txErrors = Number(r.value?.[1] || 0); }
          for (const r of rxTotals) { const dev = r.metric?.device; if (dev && devices.has(dev)) devices.get(dev).rxTotal = Number(r.value?.[1] || 0); }
          for (const r of txTotals) { const dev = r.metric?.device; if (dev && devices.has(dev)) devices.get(dev).txTotal = Number(r.value?.[1] || 0); }

          if (devices.size > 0) {
            d.push('');
            d.push('── Interface Throughput ─────────────');
            d.push(`${devices.size} interfaces detected`);
            d.push('');
            for (const [dev, info] of devices) {
              const state = info.carrier || info.operstate || 'unknown';
              const stateIcon = state === 'up' ? '[UP]' : '[DOWN]';
              d.push(`${dev}  ${stateIcon}  MAC: ${info.address || 'N/A'}`);
              d.push(`  RX: ${fmtRate(info.rxRate || 0)}  TX: ${fmtRate(info.txRate || 0)}`);
              d.push(`  RX Total: ${fmtBytes(info.rxTotal || 0)}  TX Total: ${fmtBytes(info.txTotal || 0)}`);
              const errors = (info.rxErrors || 0) + (info.txErrors || 0);
              if (errors > 0) d.push(`  Errors: ${errors} (RX: ${info.rxErrors || 0}, TX: ${info.txErrors || 0})`);
              d.push('');
            }
          }

          // Virtualization info
          const vmInfo = liveData.vmInfo?.result?.[0]?.metric;
          if (vmInfo) {
            d.push('── Virtualization ─────────────────');
            if (vmInfo.product_name) d.push(`Product: ${vmInfo.product_name}`);
            if (vmInfo.system_vendor) d.push(`Vendor: ${vmInfo.system_vendor}`);
            if (vmInfo.bios_vendor) d.push(`BIOS: ${vmInfo.bios_vendor}${vmInfo.bios_version ? ' v' + vmInfo.bios_version : ''}`);
            if (vmInfo.bios_date) d.push(`BIOS Date: ${vmInfo.bios_date}`);
            const isVM = (vmInfo.product_name || '').toLowerCase().includes('virtual') || (vmInfo.system_vendor || '').toLowerCase().includes('qemu') || (vmInfo.system_vendor || '').toLowerCase().includes('vmware');
            d.push(`Type: ${isVM ? 'Virtual Machine' : 'Physical Server'}`);
            d.push('');
          }
        }
      }
    }
  } catch (enrichErr) {
    logger.warn('[buildIncidentFromAlert] Live metrics enrichment failed: %s', enrichErr.message);
  }

  d.push('');

  if (kb) {
    d.push('── Root Cause Analysis ─────────────');
    kb.rootCause.forEach(r => d.push(`- ${r}`));
    d.push('');
    d.push('── Investigation Steps ─────────────');
    kb.investigate.forEach((s, i) => d.push(`${i + 1}. ${s}`));
    d.push('');
    d.push('── Recommended Actions ─────────────');
    kb.remediate.forEach((s, i) => d.push(`${i + 1}. ${s}`));
    d.push('');
    d.push('── Impact Assessment ───────────────');
    d.push(`Blast Radius: ${kb.blast}`);
    d.push(`Escalation: ${kb.escalation}`);
  }

  d.push('');
  d.push('── Source ──────────────────────────');
  d.push(`Alert ID: ${alert.alertId}`);
  d.push(`Source: ${alert.source}`);
  d.push(`Fired At: ${alert.firedAt?.toISOString() || 'N/A'}`);

  // Filtered metadata
  const noiseLabels = new Set([
    '__name__', 'le_code', 'isEvent', 'product_model', 'fortigatealert',
    'mode', 'alertname', 'severity', 'instance', 'job', 'hostname',
    'nodename', 'node', 'host', 'exported_instance', 'target',
    'ip', 'node_ip', 'namespace', 'pod', 'pod_name', 'container',
    'service', 'service_name', 'scrape_job', 'monitor_status', 'title',
    'ENS_message', 'ens_message', 'DiskVolumes_list', 'diskvolumes_list',
    'stats', 'statsTitle', 'datetime', 'description', 'summary',
    'huaweitb', 'huaweitbalert', 'ifDescr', 'ifName', 'ifAlias',
    'ifindex', 'ifIndex', 'ifType', 'ifOperStatus', 'ifAdminStatus',
    'snmp_host', 'oid', 'community', 'snmpVersion', 'snmp_target',
    'subject', 'value', 'threshold', 'runbook_url', 'grafana_folder',
    'org_slug', 'organization', 'client', 'group', 'groupname',
    'device', 'fstype', 'diskwarning', 'diskcritical', 'fgSysVersion',
  ]);
  const metaEntries = Object.entries(labels).filter(([k, v]) => !noiseLabels.has(k) && String(v).length > 1);
  if (metaEntries.length > 0) {
    d.push('');
    d.push('── Alert Metadata ─────────────────');
    for (const [k, v] of metaEntries) d.push(`${k}: ${v}`);
  }

  return {
    shortDescription: shortDescription.substring(0, 200),
    description: d.join('\n'),
    impact: alert.severity === 'CRITICAL' ? 'ENTERPRISE' : 'TEAM',
    urgency: alert.severity === 'CRITICAL' ? 'CRITICAL' : alert.severity === 'WARNING' ? 'HIGH' : 'MEDIUM',
    source: alert.source || 'PROMETHEUS',
    sourceAlertId: alert.alertId,
    sourceAlertName: alert.name,
    configItemId: alert.configItemId || null,
    organizationId: alert.organizationId || null,
    category: classifyCategory(alert.name),
    subcategory: classifySubcategory(alert.name),
  };
}

// GET /api/v1/alerts/kb — expose ALERT_KB as JSON for frontend consumption
function getAlertKBEndpoint(req, res) {
  // Transform KB into a more frontend-friendly format
  const entries = Object.entries(ALERT_KB).map(([key, kb]) => ({
    key,
    category: kb.cat,
    rootCauses: kb.rootCause,
    investigate: kb.investigate,
    remediate: kb.remediate,
    escalation: kb.escalation,
    blastRadius: kb.blast,
  }));
  return success(res, entries);
}

module.exports = { listAlerts, getAlert, receiveWebhook, acknowledgeAlert, silenceAlert, createIncidentFromAlert, getAlertStats, ALERT_KB, getAlertKB, getAlertKBEndpoint, parseDiskVolumes, buildIncidentFromAlert, classifyCategory, classifySubcategory };
