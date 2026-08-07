// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Incident Controller (Full CRUD)
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { deletePattern } = require('../config/redis');
const { emitToAll, emitToTeam, emitToUser, emitToIncident } = require('../config/socket');
const {
  generateIncidentNumber, calculatePriority, calculateSLATargetTimes,
  paginate, paginationMeta, success, error,
} = require('../utils/helpers');
const { INCIDENT_TRANSITIONS } = require('../config/constants');
const logger = require('../utils/logger');
const eventBus = require('../services/eventEmitter');
const { getCreateOrgId } = require('../middleware/tenant');

const INCLUDE_LIST = {
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
  assignmentGroup: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  configItem: { select: { id: true, name: true, type: true, ipAddress: true, hostname: true } },
};

const INCLUDE_DETAIL = {
  ...INCLUDE_LIST,
  organization: { select: { id: true, name: true, environment: true, slug: true, serverIp: true, fqdn: true } },
  workNotes: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
  relatedAlerts: { orderBy: { firedAt: 'desc' }, take: 20 },
  attachments: { orderBy: { createdAt: 'desc' } },
  activities: { include: { user: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 50 },
  linkedChanges: { include: { change: { select: { id: true, number: true, shortDescription: true, state: true } } } },
  linkedProblems: { include: { problem: { select: { id: true, number: true, shortDescription: true, state: true } } } },
};

// GET /api/v1/incidents
async function listIncidents(req, res, next) {
  try {
    const { state, priority, impact, urgency, category, assignedToId, assignmentGroupId, configItemId, source, slaBreached, search, dateFrom, dateTo, sortBy, sortOrder } = req.query;
    const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);

    const where = {};
    Object.assign(where, req.tenantWhere);
    if (state) where.state = state;
    if (priority) where.priority = priority;
    if (impact) where.impact = impact;
    if (urgency) where.urgency = urgency;
    if (category) where.category = category;
    if (assignedToId) where.assignedToId = assignedToId;
    if (assignmentGroupId) where.assignmentGroupId = assignmentGroupId;
    if (configItemId) where.configItemId = configItemId;
    if (source) where.source = source;
    if (slaBreached !== undefined) where.slaBreached = slaBreached === 'true';
    if (search) {
      where.OR = [
        { shortDescription: { contains: search, mode: 'insensitive' } },
        { number: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const orderBy = sortBy ? { [sortBy]: sortOrder || 'desc' } : { createdAt: 'desc' };

    const [incidents, total] = await prisma.$transaction([
      prisma.incident.findMany({ where, include: INCLUDE_LIST, orderBy, skip, take }),
      prisma.incident.count({ where }),
    ]);

    return success(res, incidents, 200, paginationMeta(total, page, limit));
  } catch (err) { next(err); }
}

// GET /api/v1/incidents/:id
async function getIncident(req, res, next) {
  try {
    const incident = await prisma.incident.findUnique({ where: { id: req.params.id }, include: INCLUDE_DETAIL });
    if (!incident) return error(res, 'Incident not found', 404);
    // Tenant access check
    if (req.tenantWhere.organizationId && incident.organizationId !== req.tenantWhere.organizationId) {
      return error(res, 'Incident not found', 404);
    }
    return success(res, incident);
  } catch (err) { next(err); }
}

// POST /api/v1/incidents
async function createIncident(req, res, next) {
  try {
    const { shortDescription, description, impact, urgency, category, subcategory, assignmentGroupId, assignedToId, configItemId, source, sourceAlertId, sourceAlertName } = req.body;

    const number = await generateIncidentNumber();
    const imp = impact || 'INDIVIDUAL';
    const urg = urgency || 'LOW';
    const priority = calculatePriority(imp, urg);
    const slaTargets = calculateSLATargetTimes(priority, new Date());

    const incident = await prisma.incident.create({
      data: {
        number, shortDescription, description,
        impact: imp, urgency: urg, priority,
        category, subcategory,
        assignmentGroupId, assignedToId, createdById: req.user.id,
        configItemId, source: source || 'MANUAL',
        organizationId: getCreateOrgId(req),
        sourceAlertId, sourceAlertName,
        slaTargetResponse: slaTargets.slaTargetResponse,
        slaTargetResolution: slaTargets.slaTargetResolution,
      },
      include: INCLUDE_LIST,
    });

    // Activity log
    await prisma.activity.create({
      data: { action: 'CREATED', description: `Incident ${number} created`, userId: req.user.id, incidentId: incident.id },
    });

    // Real-time + notifications
    emitToAll('incident:created', { id: incident.id, number, priority, shortDescription });
    if (assignmentGroupId) emitToTeam(assignmentGroupId, 'incident:assigned', incident);
    if (assignedToId) emitToUser(assignedToId, 'incident:assigned-to-you', incident);
    eventBus.emit('INCIDENT_CREATED', incident);

    deletePattern('incidents:*').catch(() => {});
    logger.info(`Incident created: ${number} by ${req.user.email}`);
    return success(res, incident, 201);
  } catch (err) { next(err); }
}

// PATCH /api/v1/incidents/:id
async function updateIncident(req, res, next) {
  try {
    const existing = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Incident not found', 404);
    // Tenant access check
    if (req.tenantWhere.organizationId && existing.organizationId !== req.tenantWhere.organizationId) {
      return error(res, 'Incident not found', 404);
    }

    // State transition validation
    if (req.body.state && req.body.state !== existing.state) {
      const allowed = INCIDENT_TRANSITIONS[existing.state] || [];
      if (!allowed.includes(req.body.state)) {
        return error(res, `Cannot transition from ${existing.state} to ${req.body.state}`, 400);
      }
    }

    // Only pick known Incident fields to prevent Prisma validation errors
    const ALLOWED_FIELDS = [
      'shortDescription', 'description', 'impact', 'urgency', 'priority',
      'category', 'subcategory', 'state', 'assignedToId', 'assignmentGroupId',
      'configItemId', 'source', 'sourceAlertId', 'sourceAlertName',
      'resolutionNotes', 'resolutionCode', 'slaBreached',
    ];
    const data = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    // Handle resolution
    if (data.state === 'RESOLVED') {
      data.resolvedAt = new Date();
      data.resolutionTime = new Date();
    }
    if (data.state === 'CLOSED') {
      data.closedAt = new Date();
    }

    // Recalculate priority if impact/urgency changed
    if (data.impact || data.urgency) {
      data.priority = calculatePriority(data.impact || existing.impact, data.urgency || existing.urgency);
    }

    const incident = await prisma.incident.update({
      where: { id: req.params.id }, data, include: INCLUDE_LIST,
    });

    // Activity log for state changes
    if (req.body.state && req.body.state !== existing.state) {
      await prisma.activity.create({
        data: {
          action: 'STATE_CHANGED', description: `State: ${existing.state} → ${req.body.state}`,
          oldValue: existing.state, newValue: req.body.state,
          userId: req.user.id, incidentId: incident.id,
        },
      });
    }

    // Activity log for assignment changes
    if (req.body.assignedToId && req.body.assignedToId !== existing.assignedToId) {
      await prisma.activity.create({
        data: { action: 'ASSIGNED', description: 'Incident reassigned', userId: req.user.id, incidentId: incident.id },
      });
      emitToUser(req.body.assignedToId, 'incident:assigned-to-you', incident);
    }

    emitToAll('incident:updated', { id: incident.id, number: incident.number, state: incident.state, priority: incident.priority });
    emitToIncident(incident.id, 'incident:detail-updated', incident);

    // Emit eventBus events for state changes (notifications, voice alerts, etc.)
    if (req.body.state && req.body.state !== existing.state) {
      if (req.body.state === 'ESCALATED') eventBus.emit('INCIDENT_ESCALATED', incident);
      if (req.body.state === 'RESOLVED')  eventBus.emit('INCIDENT_RESOLVED', incident);
    }

    deletePattern('incidents:*').catch(() => {});

    return success(res, incident);
  } catch (err) { next(err); }
}

// DELETE /api/v1/incidents/:id (ADMIN only)
async function deleteIncident(req, res, next) {
  try {
    // Tenant access check
    if (req.tenantWhere.organizationId) {
      const existing = await prisma.incident.findUnique({ where: { id: req.params.id } });
      if (!existing) return error(res, 'Incident not found', 404);
      if (existing.organizationId !== req.tenantWhere.organizationId) {
        return error(res, 'Incident not found', 404);
      }
    }
    await prisma.incident.delete({ where: { id: req.params.id } });
    deletePattern('incidents:*').catch(() => {});
    return success(res, { message: 'Incident deleted' });
  } catch (err) { next(err); }
}

// POST /api/v1/incidents/:id/notes
async function addWorkNote(req, res, next) {
  try {
    const { content, isInternal } = req.body;
    const note = await prisma.workNote.create({
      data: { content, isInternal: isInternal || false, authorId: req.user.id, incidentId: req.params.id },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
    await prisma.activity.create({
      data: { action: 'WORK_NOTE_ADDED', description: 'Work note added', userId: req.user.id, incidentId: req.params.id },
    });
    emitToIncident(req.params.id, 'incident:note-added', note);
    return success(res, note, 201);
  } catch (err) { next(err); }
}

// GET /api/v1/incidents/:id/timeline
async function getTimeline(req, res, next) {
  try {
    const [activities, notes] = await prisma.$transaction([
      prisma.activity.findMany({
        where: { incidentId: req.params.id },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workNote.findMany({
        where: { incidentId: req.params.id },
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const timeline = [
      ...activities.map((a) => ({ type: 'activity', ...a })),
      ...notes.map((n) => ({ type: 'worknote', ...n })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return success(res, timeline);
  } catch (err) { next(err); }
}

// POST /api/v1/incidents/:id/changes
async function linkChange(req, res, next) {
  try {
    const { changeId, linkType, notes } = req.body;
    const link = await prisma.incidentChange.create({
      data: { incidentId: req.params.id, changeId, linkType: linkType || 'RELATED', notes, linkedById: req.user.id },
    });
    return success(res, link, 201);
  } catch (err) { next(err); }
}

// POST /api/v1/incidents/:id/problems
async function linkProblem(req, res, next) {
  try {
    const { problemId, linkType, notes } = req.body;
    const link = await prisma.incidentProblem.create({
      data: { incidentId: req.params.id, problemId, linkType: linkType || 'RELATED', notes, linkedById: req.user.id },
    });
    return success(res, link, 201);
  } catch (err) { next(err); }
}

// ── GET /api/v1/incidents/:id/live-context ──────────────
// Full operational context: parsed alert labels, live Prometheus metrics,
// firing alerts, past incidents, responders — everything a responder needs.

async function getLiveContext(req, res, next) {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: req.params.id },
      include: {
        relatedAlerts: { orderBy: { firedAt: 'desc' }, take: 20 },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true } },
        assignmentGroup: { select: { id: true, name: true } },
        configItem: { select: { id: true, name: true, type: true, ipAddress: true, hostname: true, os: true, manufacturer: true, model: true } },
        linkedChanges: { include: { change: { select: { id: true, number: true, shortDescription: true, state: true } } } },
        linkedProblems: { include: { problem: { select: { id: true, number: true, shortDescription: true, state: true } } } },
        organization: { select: { id: true, name: true, environment: true, slug: true, serverIp: true, fqdn: true } },
      },
    });
    if (!incident) return error(res, 'Incident not found', 404);
    if (req.tenantWhere?.organizationId && incident.organizationId !== req.tenantWhere.organizationId) {
      return error(res, 'Incident not found', 404);
    }

    // ── Parse alert labels + annotations ──
    // Fallback chain: relatedAlerts → Alert by sourceAlertId → Alert by name+org → extract from sourceAlertName
    let labels = {}, annotations = {};
    let firstAlert = incident.relatedAlerts?.[0];

    // Fallback 1: If no relatedAlerts, query Alert table by alertId matching sourceAlertId
    if (!firstAlert && incident.sourceAlertId) {
      const fallbackAlert = await prisma.alert.findFirst({
        where: {
          alertId: incident.sourceAlertId,
          ...(incident.organizationId ? { organizationId: incident.organizationId } : {}),
        },
        orderBy: { firedAt: 'desc' },
      });
      if (fallbackAlert) firstAlert = fallbackAlert;
    }

    // Fallback 2: Query by sourceAlertName + org
    if (!firstAlert && incident.sourceAlertName && incident.organizationId) {
      const fallbackAlert = await prisma.alert.findFirst({
        where: {
          name: incident.sourceAlertName,
          organizationId: incident.organizationId,
        },
        orderBy: { firedAt: 'desc' },
      });
      if (fallbackAlert) firstAlert = fallbackAlert;
    }

    if (firstAlert) {
      try { labels = JSON.parse(firstAlert.labels || '{}'); } catch (e) { logger.warn('Failed to parse alert labels: %s', e.message); }
      try { annotations = JSON.parse(firstAlert.annotations || '{}'); } catch (e) { logger.warn('Failed to parse alert annotations: %s', e.message); }
    }

    let instance = labels.instance || labels.target || '';
    let ip = instance.split(':')[0] || labels.ip || labels.node_ip || '';
    const hostname = labels.hostname || labels.nodename || labels.node || labels.host || labels.exported_instance || '';
    const namespace = labels.namespace || '';
    const pod = labels.pod || labels.pod_name || '';
    const job = labels.job || labels.scrape_job || '';
    const alertName = labels.alertname || incident.sourceAlertName || '';
    const dashboardUrl = annotations.dashboard_url || annotations.grafana_dashboard || annotations.dashboard || '';
    const runbookUrl = annotations.runbook_url || '';
    const summary = annotations.summary || annotations.description || '';

    // Fallback 3: Extract IP from sourceAlertName (e.g., "HostDown-172.20.1.88")
    if (!ip && incident.sourceAlertName) {
      const ipMatch = incident.sourceAlertName.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (ipMatch) { ip = ipMatch[1]; instance = instance || `${ip}:9100`; }
    }

    // Fallback 4: Use configItem IP
    if (!ip && incident.configItem?.ipAddress) {
      ip = incident.configItem.ipAddress;
      instance = instance || `${ip}:9100`;
    }

    // Fallback 5: If still no IP but incident has a configItem with hostname, look up IP from other CIs
    if (!ip && incident.configItem?.hostname && incident.organizationId) {
      const ciWithIp = await prisma.configurationItem.findFirst({
        where: {
          organizationId: incident.organizationId,
          hostname: incident.configItem.hostname,
          ipAddress: { not: null },
        },
        select: { ipAddress: true },
      });
      if (ciWithIp?.ipAddress) {
        ip = ciWithIp.ipAddress;
        instance = instance || `${ip}:9100`;
      }
    }

    // Fallback 6: If still no IP but incident has a configItem (any type), use the org's primary server IP
    // This is a last resort so at least "some" host metrics show for the org's infrastructure
    if (!ip && incident.organizationId && !incident.configItem?.ipAddress) {
      const orgForIp = await prisma.organization.findUnique({
        where: { id: incident.organizationId },
        select: { serverIp: true },
      });
      if (orgForIp?.serverIp) {
        ip = orgForIp.serverIp;
        instance = instance || `${ip}:9100`;
      }
    }

    // ── Live Prometheus metrics (instance-scoped) ──
    let metrics = { available: false, error: null };
    let firingAlerts = [];

    // Debug: log IP resolution result for troubleshooting
    if (!ip) {
      logger.debug('[getLiveContext] No IP resolved for incident %s (org: %s, alertName: %s, configItem: %s)',
        incident.number, incident.organizationId, incident.sourceAlertName || 'none', incident.configItem?.hostname || 'none');
    } else {
      logger.debug('[getLiveContext] Resolved IP %s for incident %s (instance: %s)', ip, incident.number, instance);
    }

    try {
      const aiCtrl = require('./aiAgent.controller');
      if (ip && incident.organizationId && aiCtrl.resolvePrometheusAccess && aiCtrl.executePromQueries) {
        let access = await aiCtrl.resolvePrometheusAccess(incident.organizationId);

        // Handle 'local' method: convert to 'direct' using configured PROMETHEUS_URL
        if (access.method === 'local') {
          const { config: envConfig } = require('../config/env');
          const localPromUrl = envConfig.observability?.prometheusUrl;
          if (localPromUrl) {
            access = { method: 'direct', promUrl: localPromUrl.replace(/\/+$/, '') };
          }
        }

        if (access.method !== 'local') {
          // Detect Windows vs Linux from instance port or job name
          const instancePort = instance.includes(':') ? instance.split(':').pop() : '';
          const isWindows = instancePort === '9182' || (job || '').toUpperCase().includes('WINDOWS');
          const defaultPort = isWindows ? '9182' : '9100';
          const target = ip.includes(':') ? ip : `${ip}:${defaultPort}`;

          // Build OS-specific PromQL queries
          const queryMap = isWindows ? {
            // ── Windows (windows_exporter on :9182) ──
            cpuUsage: `100 - (avg by (instance)(irate(windows_cpu_time_total{mode="idle",instance=~"${target}"}[5m])) * 100)`,
            cpuCount: `windows_cs_logical_processors{instance=~"${target}"}`,
            memTotal: `windows_cs_physical_memory_bytes{instance=~"${target}"}`,
            memAvail: `windows_os_physical_memory_free_bytes{instance=~"${target}"}`,
            swapTotal: `windows_os_virtual_memory_bytes{instance=~"${target}"}`,
            swapFree: `windows_os_virtual_memory_free_bytes{instance=~"${target}"}`,
            fsSize: `windows_logical_disk_size_bytes{instance=~"${target}"}`,
            fsFree: `windows_logical_disk_free_bytes{instance=~"${target}"}`,
            diskIOPS: `rate(windows_logical_disk_reads_total{instance=~"${target}"}[5m]) + rate(windows_logical_disk_writes_total{instance=~"${target}"}[5m])`,
            netRxRate: `rate(windows_net_bytes_received_total{instance=~"${target}"}[5m])`,
            netTxRate: `rate(windows_net_bytes_sent_total{instance=~"${target}"}[5m])`,
            osInfo: `windows_os_info{instance=~"${target}"}`,
            bootTime: `windows_system_system_up_time{instance=~"${target}"}`,
          } : {
            // ── Linux (node_exporter on :9100) ──
            cpuUsage: `100 - (avg by (instance)(irate(node_cpu_seconds_total{mode="idle",instance=~"${target}"}[5m])) * 100)`,
            cpuCount: `count(node_cpu_seconds_total{mode="idle",instance=~"${target}"})`,
            load1: `node_load1{instance=~"${target}"}`,
            load5: `node_load5{instance=~"${target}"}`,
            load15: `node_load15{instance=~"${target}"}`,
            memTotal: `node_memory_MemTotal_bytes{instance=~"${target}"}`,
            memAvail: `node_memory_MemAvailable_bytes{instance=~"${target}"}`,
            swapTotal: `node_memory_SwapTotal_bytes{instance=~"${target}"}`,
            swapFree: `node_memory_SwapFree_bytes{instance=~"${target}"}`,
            fsSize: `node_filesystem_size_bytes{instance=~"${target}",fstype!~"tmpfs|devtmpfs|overlay|squashfs"}`,
            fsAvail: `node_filesystem_avail_bytes{instance=~"${target}",fstype!~"tmpfs|devtmpfs|overlay|squashfs"}`,
            diskIOPS: `rate(node_disk_reads_completed_total{instance=~"${target}"}[5m]) + rate(node_disk_writes_completed_total{instance=~"${target}"}[5m])`,
            netInfo: `node_network_info{instance=~"${target}"}`,
            netRxRate: `rate(node_network_receive_bytes_total{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}[5m])`,
            netTxRate: `rate(node_network_transmit_bytes_total{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}[5m])`,
            netRxErrs: `node_network_receive_errs_total{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}`,
            netTxErrs: `node_network_transmit_errs_total{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}`,
            netCarrier: `node_network_carrier{instance=~"${target}",device!~"lo|veth.*|cali.*|flannel.*|br-.*"}`,
            uname: `node_uname_info{instance=~"${target}"}`,
            bootTime: `node_boot_time_seconds{instance=~"${target}"}`,
          };

          // 10s timeout so we don't block the endpoint
          const promData = await Promise.race([
            aiCtrl.executePromQueries(access, queryMap),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Prometheus timeout')), 10000)),
          ]);

          if (promData) {
            const pv = (key) => parseFloat(promData[key]?.result?.[0]?.value?.[1] || '0');
            const cpuPct = pv('cpuUsage');
            const cpuCores = isWindows ? Math.round(pv('cpuCount')) : Math.round(pv('cpuCount'));
            const memTotalB = pv('memTotal');
            const memAvailB = pv('memAvail');
            const memUsedPct = memTotalB > 0 ? ((1 - memAvailB / memTotalB) * 100) : 0;
            const swapTotalB = pv('swapTotal');
            const swapUsedB = swapTotalB - pv('swapFree');
            const bootTs = pv('bootTime');
            const uptimeSec = bootTs > 0 ? Math.floor(Date.now() / 1000 - bootTs) : 0;

            // Filesystems — Windows uses volume (C:, D:) vs Linux uses mountpoint
            const fsSizeResults = promData.fsSize?.result || [];
            const fsFreeResults = isWindows ? (promData.fsFree?.result || []) : (promData.fsAvail?.result || []);
            const fsMap = {};
            for (const r of fsSizeResults) {
              const mp = isWindows ? (r.metric?.volume || 'C:') : (r.metric?.mountpoint || '/');
              fsMap[mp] = { total: parseFloat(r.value?.[1] || '0'), device: r.metric?.device || r.metric?.volume || '', fstype: r.metric?.fstype || r.metric?.type || '' };
            }
            for (const r of fsFreeResults) {
              const mp = isWindows ? (r.metric?.volume || 'C:') : (r.metric?.mountpoint || '/');
              if (fsMap[mp]) fsMap[mp].avail = parseFloat(r.value?.[1] || '0');
            }
            const filesystems = Object.entries(fsMap).map(([mp, fs]) => {
              const used = fs.total - (fs.avail || 0);
              const usedPct = fs.total > 0 ? (used / fs.total * 100).toFixed(1) : '0';
              return { mountpoint: mp, device: fs.device, fstype: fs.fstype, totalBytes: fs.total, usedBytes: used, usedPct: parseFloat(usedPct) };
            });

            // Network interfaces
            let interfaces = [];
            if (isWindows) {
              // Windows: simpler — just rx/tx rates per nic
              const rxRates = promData.netRxRate?.result || [];
              const txRates = promData.netTxRate?.result || [];
              const nicMap = new Map();
              for (const r of rxRates) { const n = r.metric?.nic || r.metric?.name; if (n) nicMap.set(n, { rxBps: Number(r.value?.[1] || 0) }); }
              for (const r of txRates) { const n = r.metric?.nic || r.metric?.name; if (n && nicMap.has(n)) nicMap.get(n).txBps = Number(r.value?.[1] || 0); }
              for (const [name, info] of nicMap) {
                interfaces.push({ name, status: 'UP', operstate: 'up', mac: '', rxBps: info.rxBps || 0, txBps: info.txBps || 0, rxErrors: 0, txErrors: 0 });
              }
            } else {
              // Linux: full info with carrier/errors
              const ifInfo = promData.netInfo?.result || [];
              const rxRates = promData.netRxRate?.result || [];
              const txRates = promData.netTxRate?.result || [];
              const rxErrs = promData.netRxErrs?.result || [];
              const txErrs = promData.netTxErrs?.result || [];
              const carriers = promData.netCarrier?.result || [];
              const devMap = new Map();
              for (const r of ifInfo) { const d = r.metric?.device; if (d) devMap.set(d, { operstate: r.metric?.operstate || 'unknown', address: r.metric?.address || '' }); }
              for (const r of carriers) { const d = r.metric?.device; if (d && devMap.has(d)) devMap.get(d).carrier = r.value?.[1] === '1'; }
              for (const r of rxRates) { const d = r.metric?.device; if (d && devMap.has(d)) devMap.get(d).rxRate = Number(r.value?.[1] || 0); }
              for (const r of txRates) { const d = r.metric?.device; if (d && devMap.has(d)) devMap.get(d).txRate = Number(r.value?.[1] || 0); }
              for (const r of rxErrs) { const d = r.metric?.device; if (d && devMap.has(d)) devMap.get(d).rxErrs = Number(r.value?.[1] || 0); }
              for (const r of txErrs) { const d = r.metric?.device; if (d && devMap.has(d)) devMap.get(d).txErrs = Number(r.value?.[1] || 0); }
              for (const [name, info] of devMap) {
                interfaces.push({ name, status: info.carrier ? 'UP' : 'DOWN', operstate: info.operstate, mac: info.address, rxBps: info.rxRate || 0, txBps: info.txRate || 0, rxErrors: info.rxErrs || 0, txErrors: info.txErrs || 0 });
              }
            }

            // System info
            let sysInfo;
            if (isWindows) {
              const winInfo = promData.osInfo?.result?.[0]?.metric || {};
              sysInfo = { hostname: winInfo.hostname || hostname || '', os: winInfo.product || winInfo.caption || 'Windows', kernel: winInfo.version || '', arch: 'x86_64', uptimeSeconds: uptimeSec };
            } else {
              const unameInfo = promData.uname?.result?.[0]?.metric || {};
              sysInfo = { hostname: unameInfo.nodename || hostname || '', os: unameInfo.sysname || '', kernel: unameInfo.release || '', arch: unameInfo.machine || '', uptimeSeconds: uptimeSec };
            }

            metrics = {
              available: true,
              osType: isWindows ? 'windows' : 'linux',
              cpu: { usagePct: parseFloat(cpuPct.toFixed(1)), cores: cpuCores },
              load: isWindows ? { m1: 0, m5: 0, m15: 0 } : { m1: pv('load1'), m5: pv('load5'), m15: pv('load15') },
              memory: { totalBytes: memTotalB, availBytes: memAvailB, usedPct: parseFloat(memUsedPct.toFixed(1)), swapTotalBytes: swapTotalB, swapUsedBytes: swapUsedB },
              filesystems,
              diskIOPS: parseFloat(pv('diskIOPS').toFixed(1)),
              interfaces,
              sysInfo,
            };
          }

          // Get firing alerts from AlertManager
          try {
            if (aiCtrl.fetchRemoteAlerts) {
              const alertResult = await Promise.race([
                aiCtrl.fetchRemoteAlerts(access),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
              ]);
              firingAlerts = (alertResult?.alerts || []).slice(0, 30);
            }
          } catch (e) { logger.warn('[getLiveContext] fetchRemoteAlerts error: %s', e.message); }
        }
      }
    } catch (promErr) {
      metrics.error = promErr.message || 'Prometheus unreachable';
      logger.warn('[getLiveContext] Prometheus error: %s', promErr.message);
    }

    // ── Past incidents (same category or configItem, resolved, last 30 days) ──
    const pastWhere = {
      AND: [
        { id: { not: incident.id } },
        ...(req.tenantWhere?.organizationId ? [{ organizationId: req.tenantWhere.organizationId }] : []),
        { state: { in: ['RESOLVED', 'CLOSED'] } },
        { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      ],
    };
    const orConditions = [];
    if (incident.category) orConditions.push({ category: incident.category });
    if (incident.configItemId) orConditions.push({ configItemId: incident.configItemId });
    if (incident.sourceAlertName) orConditions.push({ sourceAlertName: incident.sourceAlertName });
    if (orConditions.length > 0) pastWhere.AND.push({ OR: orConditions });

    const pastIncidents = orConditions.length > 0 ? await prisma.incident.findMany({
      where: pastWhere,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, number: true, shortDescription: true, priority: true, state: true, category: true, createdAt: true, resolvedAt: true, resolutionCode: true },
    }) : [];

    return success(res, {
      incident: { id: incident.id, number: incident.number, state: incident.state, priority: incident.priority, shortDescription: incident.shortDescription, organizationId: incident.organizationId },
      organization: incident.organization,
      alertContext: {
        labels, annotations, alertName, instance, ip, hostname, namespace, pod, job,
        dashboardUrl, runbookUrl, summary,
        severity: labels.severity || firstAlert?.severity || null,
        alertCount: (incident.relatedAlerts?.length || 0) || (firstAlert ? 1 : 0),
      },
      metrics,
      firingAlerts,
      // Include fallback alert if relatedAlerts is empty but we found one via sourceAlertId/name
      relatedAlerts: incident.relatedAlerts?.length > 0
        ? incident.relatedAlerts
        : (firstAlert ? [firstAlert] : []),
      pastIncidents,
      responders: {
        assignee: incident.assignedTo,
        team: incident.assignmentGroup,
      },
      linkedChanges: incident.linkedChanges || [],
      linkedProblems: incident.linkedProblems || [],
      configItem: incident.configItem,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
}

// GET /api/v1/incidents/:id/escalation-logs
async function getEscalationLogs(req, res, next) {
  try {
    const incident = await prisma.incident.findUnique({ where: { id: req.params.id }, select: { id: true, organizationId: true, escalationLevel: true } });
    if (!incident) return error(res, 'Incident not found', 404);
    if (req.tenantWhere?.organizationId && incident.organizationId !== req.tenantWhere.organizationId) {
      return error(res, 'Incident not found', 404);
    }

    const logs = await prisma.escalationLog.findMany({
      where: { incidentId: req.params.id },
      orderBy: { attemptedAt: 'desc' },
    });

    return success(res, { escalationLevel: incident.escalationLevel, logs });
  } catch (err) { next(err); }
}

// ── GET /api/v1/incidents/:id/ack?token=<jwt> ─────────────
// One-click acknowledge from email link — no login required.
// Token signed with JWT_SECRET, contains { incidentId, action:'ack' }
// Returns branded HTML response page.
async function acknowledgeFromEmail(req, res) {
  const jwt = require('jsonwebtoken');
  const { token } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'https://fs-le-dev-inc.finspot.in';

  function htmlPage(title, icon, color, message, incidentNumber, detail) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0F172A;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#1E293B;border:1px solid #334155;border-radius:16px;padding:48px 40px;max-width:480px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.5)}
  .icon{font-size:56px;margin-bottom:20px;display:block}
  .badge{display:inline-block;background:${color}22;border:1px solid ${color}44;color:${color};font-size:11px;font-weight:700;letter-spacing:1px;padding:4px 12px;border-radius:20px;text-transform:uppercase;margin-bottom:16px}
  h1{color:#F1F5F9;font-size:26px;font-weight:800;margin-bottom:8px}
  .inc{color:${color};font-size:15px;font-weight:700;margin-bottom:12px}
  p{color:#94A3B8;font-size:14px;line-height:1.7;margin-bottom:24px}
  .btn{display:inline-block;background:${color};color:#fff;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.3px}
  .footer{margin-top:28px;color:#475569;font-size:11px}
</style>
</head><body>
<div class="card">
  <span class="icon">${icon}</span>
  <div class="badge">${title}</div>
  <h1>${message}</h1>
  <p class="inc">${incidentNumber}</p>
  <p>${detail}</p>
  <a href="${frontendUrl}/incidents" class="btn">Open LinkedEye ITSM →</a>
  <p class="footer">FinSpot ITSM Tool · FinSpot Technology Solutions Pvt Ltd</p>
</div>
</body></html>`;
  }

  if (!token) {
    return res.status(400).send(htmlPage('Invalid Link', '⚠️', '#D97706', 'Invalid acknowledge link', '', 'This link is missing a required token. Please open LinkedEye ITSM directly.'));
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(400).send(htmlPage('Link Expired', '⏰', '#D97706', 'Acknowledge link expired', '', 'This one-click link has expired (valid for 24 hours). Please log in to LinkedEye ITSM to acknowledge the incident.'));
  }

  if (payload.action !== 'ack' || !payload.incidentId) {
    return res.status(400).send(htmlPage('Invalid Link', '⚠️', '#D97706', 'Invalid token', '', 'This link is not valid for incident acknowledgment.'));
  }

  try {
    const incident = await prisma.incident.findUnique({
      where: { id: payload.incidentId },
      select: { id: true, number: true, state: true, shortDescription: true },
    });

    if (!incident) {
      return res.status(404).send(htmlPage('Not Found', '🔍', '#94A3B8', 'Incident not found', '', 'This incident may have been deleted or does not exist.'));
    }

    if (['RESOLVED', 'CLOSED'].includes(incident.state)) {
      return res.send(htmlPage('Already Resolved', '✅', '#059669', 'Incident already resolved', incident.number, `${incident.shortDescription}<br/><br/>This incident was already resolved. No action needed.`));
    }

    if (incident.state === 'IN_PROGRESS') {
      return res.send(htmlPage('Already Acknowledged', '✅', '#059669', 'Already acknowledged', incident.number, `${incident.shortDescription}<br/><br/>This incident is acknowledged and in progress. Escalation will continue to next level if unresolved.`));
    }

    // Acknowledge: transition to IN_PROGRESS.
    // escalationLevel is intentionally NOT reset — escalation engine continues
    // to L2, L3 based on elapsed time until incident is RESOLVED/CLOSED.
    await prisma.incident.update({
      where: { id: incident.id },
      data: { state: 'IN_PROGRESS' },
    });

    // Activity log
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
    if (adminUser) {
      await prisma.activity.create({
        data: {
          action:      'STATE_CHANGE',
          description: `Acknowledged via email one-click link. State → IN_PROGRESS. Escalation continues to next level if unresolved.`,
          incidentId:  incident.id,
          userId:      adminUser.id,
        },
      });
    }

    logger.info(`[Ack] ${incident.number} acknowledged via email — IN_PROGRESS, escalation chain continues`);

    return res.send(htmlPage(
      'Acknowledged',
      '🎯',
      '#059669',
      'Incident Acknowledged',
      incident.number,
      `<strong style="color:#F1F5F9">${incident.shortDescription}</strong><br/><br/>Escalation has been <strong style="color:#059669">stopped</strong>. The incident is now <strong style="color:#059669">IN PROGRESS</strong>. Please log in to LinkedEye ITSM to update the work notes and resolve the issue.`,
    ));
  } catch (err) {
    logger.error(`[Ack] Email acknowledge failed: ${err.message}`);
    return res.status(500).send(htmlPage('Error', '❌', '#DC2626', 'Something went wrong', '', 'An error occurred while acknowledging this incident. Please log in to LinkedEye ITSM directly.'));
  }
}

module.exports = { listIncidents, getIncident, createIncident, updateIncident, deleteIncident, addWorkNote, getTimeline, linkChange, linkProblem, getLiveContext, getEscalationLogs, acknowledgeFromEmail };
