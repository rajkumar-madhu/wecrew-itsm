// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — APM Service
// Real production metrics via SSH → Prometheus + Redis
//
// 1. Process Status:  SSH → redis-cli → ADP keys
// 2. Infrastructure:  SSH → Prometheus (node_exporter)
// 3. Network:         SSH → Prometheus (node_network_*)
// 4. K8s Health:      SSH → Prometheus (kube_*)
// 5. Services:        SSH → Prometheus (up{}, probe_*)
// 6. Active Alerts:   SSH → AlertManager API
// 7. URL Checker:     SSH → Redis BOD_URLChecker keys
// ═══════════════════════════════════════════════════════════

const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const k8s = require('./k8sService');
const { safeHost, safeUser, safePort, safeToken } = require('../utils/shellSafe');

const execAsync = promisify(exec);

// ── SSH helpers ─────────────────────────────────────────

// Every value below lands in a string run by exec() on the API pod: allowlist, never escape.
function sshCmd(serverIp, sshPort = 4422, sshUser = 'finadmin') {
  serverIp = safeHost(serverIp);
  sshPort = safePort(sshPort, 'sshPort');
  sshUser = safeUser(sshUser);
  return `ssh -p ${sshPort} -i /home/finadmin/.ssh/id_ed25519 \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=4 \
    -o BatchMode=yes \
    ${sshUser}@${serverIp}`;
}

async function remoteExec(serverIp, cmd, sshPort = 4422, sshUser = 'finadmin') {
  const full = `${sshCmd(serverIp, sshPort, sshUser)} "${cmd}"`;
  const { stdout } = await execAsync(full, { timeout: 5000 });
  return stdout.trim();
}

// ── Redis CLI helpers ───────────────────────────────────

async function redisCli(serverIp, sshPort, sshUser, redisHost, redisPort, redisPass, command) {
  redisHost = safeHost(redisHost, 'redisHost');
  redisPort = safePort(redisPort, 'redisPort');
  if (redisPass) safeToken(redisPass, 'redisPass');
  const auth = redisPass ? `-a '${redisPass}'` : '';
  const cmd = `redis-cli -h ${redisHost} -p ${redisPort} ${auth} --no-auth-warning ${command} 2>/dev/null`;
  return remoteExec(serverIp, cmd, sshPort, sshUser);
}

// Redis key names/patterns: no quotes, spaces, $, backticks or ; — they are
// interpolated into the shell. Keys come back from the REMOTE Redis, so a key
// that fails this is skipped rather than run.
const SAFE_REDIS_KEY = /^[A-Za-z0-9:_.@/+*?\[\]-]{1,256}$/;

async function redisKeys(serverIp, sshPort, sshUser, redisHost, redisPort, redisPass, pattern) {
  if (!SAFE_REDIS_KEY.test(String(pattern))) throw new Error('Unsafe Redis key pattern');
  const raw = await redisCli(serverIp, sshPort, sshUser, redisHost, redisPort, redisPass, `keys "${pattern}"`);
  return raw ? raw.split('\n').filter(k => k && !k.startsWith('(') && !k.startsWith('Warning')) : [];
}

async function redisGet(serverIp, sshPort, sshUser, redisHost, redisPort, redisPass, key) {
  if (!SAFE_REDIS_KEY.test(String(key)) || /[*?[\]]/.test(key)) {
    logger.warn('[APM] skipping Redis key with unsafe characters');
    return null;
  }
  const raw = await redisCli(serverIp, sshPort, sshUser, redisHost, redisPort, redisPass, `get "${key}"`);
  if (!raw || raw === '(nil)' || raw.startsWith('(error)')) return null;
  try { return JSON.parse(raw); } catch { return { raw }; }
}

// ── Status decoder ──────────────────────────────────────

const STATUS_MAP = { 0: 'CRITICAL', 1: 'WARNING', 2: 'UP', 3: 'UNKNOWN', 5: 'EDITED' };

function decodeStatus(code) {
  return STATUS_MAP[parseInt(code, 10)] ?? 'UNKNOWN';
}

// ── ADP key parser ──────────────────────────────────────

function parseAdpKey(key) {
  const colonIdx = key.indexOf(':ADP:ADP-');
  if (colonIdx === -1) return null;
  const subsite = key.substring(0, colonIdx);
  const rest = key.substring(colonIdx + ':ADP:ADP-'.length);
  const dashIdx = rest.indexOf('-');
  const system = dashIdx !== -1 ? rest.substring(0, dashIdx) : rest;
  const processName = dashIdx !== -1 ? rest.substring(dashIdx + 1) : rest;
  return { subsite, system, processName };
}

function parseAdpData(keyData) {
  if (!keyData) return { status: 'UNKNOWN', statusCode: 3, message: '', lastCheck: null, uptime: null };
  const raw = keyData.status ?? keyData.statusCode ?? keyData.code ?? keyData.state ?? 2;
  const code = parseInt(raw, 10);
  return {
    status: decodeStatus(code), statusCode: code,
    message: keyData.message || keyData.msg || keyData.description || '',
    lastCheck: keyData.executedOn || keyData.checked_at || keyData.timestamp || new Date().toISOString(),
    uptime: keyData.uptime != null ? parseFloat(keyData.uptime) : null,
  };
}

// ── Prometheus value helpers ────────────────────────────

function promVal(result, idx = 0) {
  const r = result?.result;
  if (!r || !r[idx]) return null;
  return parseFloat(r[idx].value?.[1] ?? 0);
}

function promAllVals(result) {
  const r = result?.result;
  if (!r || !r.length) return [];
  return r.map(item => ({
    labels: item.metric || {},
    value: parseFloat(item.value?.[1] ?? 0),
  }));
}

// ══════════════════════════════════════════════════════════
// 1. Process Status (from Redis)
// ══════════════════════════════════════════════════════════

function generateFallbackProcessStatus(siteName, processDefinitions, subsiteNames) {
  const subs = subsiteNames?.length ? subsiteNames : [`${siteName}-prod`, `${siteName}-dr`];
  return subs.map((subsite, si) => {
    const defs = processDefinitions && Object.keys(processDefinitions).length
      ? processDefinitions
      : { 'Services': ['app-server', 'db-primary', 'db-replica', 'cache', 'queue', 'gateway'] };
    const groups = {};
    for (const [groupName, procs] of Object.entries(defs)) {
      groups[groupName] = procs.map((proc, pi) => {
        let sc = 2;
        if (si === 0 && pi === 3 && Object.keys(defs).indexOf(groupName) === 0) sc = 1;
        if (si === 1 && pi === 1 && Object.keys(defs).indexOf(groupName) === 1) sc = 0;
        const lastCheck = new Date(Date.now() - Math.floor(Math.random() * 45) * 1000);
        const uptime = sc === 2 ? +(97 + Math.random() * 3).toFixed(1) :
                       sc === 1 ? +(94 + Math.random() * 2).toFixed(1) : 91.0;
        return {
          name: proc, key: `${subsite}:ADP:ADP-${groupName.replace(/\s+/g, '_')}-${proc}`,
          status: decodeStatus(sc), statusCode: sc,
          message: sc === 0 ? 'Process not responding' : sc === 1 ? 'Elevated error rate' : '',
          lastCheck: lastCheck.toISOString(), uptime,
        };
      });
    }
    return { subsite, groups };
  });
}

async function getProcessStatus(cfg) {
  const { serverIp, sshPort = 4422, sshUser = 'finadmin',
    redisHost = 'localhost', redisPort = 6379, redisPass = '',
    siteName = 'prod', subsiteNames = [], adpPattern = '*:ADP:*', processDefinitions = {},
  } = cfg;

  if (!serverIp) {
    return { simulated: true, subsites: generateFallbackProcessStatus(siteName, processDefinitions, subsiteNames) };
  }

  try {
    const keys = await redisKeys(serverIp, sshPort, sshUser, redisHost, redisPort, redisPass, adpPattern);
    if (!keys.length) {
      logger.info('[APM] No ADP keys found, using fallback');
      return { simulated: true, subsites: generateFallbackProcessStatus(siteName, processDefinitions, subsiteNames) };
    }
    const values = await Promise.allSettled(
      keys.slice(0, 200).map(k => redisGet(serverIp, sshPort, sshUser, redisHost, redisPort, redisPass, k))
    );
    const subsiteMap = {};
    for (let i = 0; i < keys.length && i < 200; i++) {
      const parsed = parseAdpKey(keys[i]);
      if (!parsed) continue;
      const { subsite, system, processName } = parsed;
      const data = values[i].status === 'fulfilled' ? values[i].value : null;
      const proc = { name: processName, key: keys[i], system, ...parseAdpData(data) };
      if (!subsiteMap[subsite]) subsiteMap[subsite] = {};
      if (!subsiteMap[subsite][system]) subsiteMap[subsite][system] = [];
      subsiteMap[subsite][system].push(proc);
    }
    return { simulated: false, subsites: Object.entries(subsiteMap).map(([subsite, systemMap]) => ({ subsite, groups: systemMap })) };
  } catch (err) {
    logger.warn('[APM] Redis SSH failed, using fallback: %s', err.message);
    return { simulated: true, subsites: generateFallbackProcessStatus(siteName, processDefinitions, subsiteNames) };
  }
}

// ══════════════════════════════════════════════════════════
// 2. Infrastructure Metrics (from Prometheus)
// ══════════════════════════════════════════════════════════

async function getInfrastructureMetrics(cfg) {
  const { serverIp, sshPort = 4422, sshUser = 'finadmin', promPort = 30000 } = cfg;
  if (!serverIp) return { simulated: true, metrics: generateFallbackInfra() };

  try {
    const queries = {
      // CPU
      cpuUsage: '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
      cpuCores: 'count(node_cpu_seconds_total{mode="idle"})',
      loadAvg1: 'node_load1',
      loadAvg5: 'node_load5',
      loadAvg15: 'node_load15',
      // Memory
      memTotal: 'node_memory_MemTotal_bytes',
      memAvailable: 'node_memory_MemAvailable_bytes',
      memBuffers: 'node_memory_Buffers_bytes + node_memory_Cached_bytes',
      swapTotal: 'node_memory_SwapTotal_bytes',
      swapFree: 'node_memory_SwapFree_bytes',
      // Disk
      diskTotal: 'sum(node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"})',
      diskFree: 'sum(node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"})',
      diskAllMounts: 'node_filesystem_size_bytes{fstype!~"tmpfs|devtmpfs|overlay|squashfs"}',
      diskAllFree: 'node_filesystem_avail_bytes{fstype!~"tmpfs|devtmpfs|overlay|squashfs"}',
      diskIoRead: 'rate(node_disk_read_bytes_total[5m])',
      diskIoWrite: 'rate(node_disk_written_bytes_total[5m])',
      // System
      uptime: 'node_time_seconds - node_boot_time_seconds',
      hostname: 'node_uname_info',
    };

    const results = await k8s.batchRemotePromQueries(serverIp, queries, sshPort, promPort, sshUser);

    // Parse filesystem mounts
    const mountsRaw = promAllVals(results.diskAllMounts);
    const mountsFreeRaw = promAllVals(results.diskAllFree);
    const mounts = mountsRaw.map(m => {
      const freeEntry = mountsFreeRaw.find(f =>
        f.labels.mountpoint === m.labels.mountpoint && f.labels.device === m.labels.device
      );
      const total = m.value;
      const free = freeEntry?.value || 0;
      const used = total - free;
      return {
        mountpoint: m.labels.mountpoint,
        device: m.labels.device,
        fstype: m.labels.fstype,
        totalBytes: total,
        usedBytes: used,
        freeBytes: free,
        usedPercent: total > 0 ? +((used / total) * 100).toFixed(1) : 0,
      };
    }).filter(m => m.totalBytes > 0);

    // Parse disk IO per device
    const ioRead = promAllVals(results.diskIoRead);
    const ioWrite = promAllVals(results.diskIoWrite);
    const diskIo = {};
    for (const r of ioRead) {
      const dev = r.labels.device;
      if (!diskIo[dev]) diskIo[dev] = { device: dev, readBps: 0, writeBps: 0 };
      diskIo[dev].readBps = r.value;
    }
    for (const w of ioWrite) {
      const dev = w.labels.device;
      if (!diskIo[dev]) diskIo[dev] = { device: dev, readBps: 0, writeBps: 0 };
      diskIo[dev].writeBps = w.value;
    }

    // Parse hostname info
    const hostnameInfo = results.hostname?.result?.[0]?.metric || {};

    const memTotal = promVal(results, 'memTotal') || promVal(results.memTotal);
    const memAvail = promVal(results, 'memAvailable') || promVal(results.memAvailable);

    const metrics = {
      cpu: {
        usagePercent: +(promVal(results.cpuUsage) || 0).toFixed(1),
        cores: promVal(results.cpuCores) || 0,
        loadAvg: {
          '1m': +(promVal(results.loadAvg1) || 0).toFixed(2),
          '5m': +(promVal(results.loadAvg5) || 0).toFixed(2),
          '15m': +(promVal(results.loadAvg15) || 0).toFixed(2),
        },
      },
      memory: {
        totalBytes: promVal(results.memTotal) || 0,
        availableBytes: promVal(results.memAvailable) || 0,
        buffersBytes: promVal(results.memBuffers) || 0,
        usedPercent: promVal(results.memTotal) > 0
          ? +(((promVal(results.memTotal) - promVal(results.memAvailable)) / promVal(results.memTotal)) * 100).toFixed(1) : 0,
        swapTotalBytes: promVal(results.swapTotal) || 0,
        swapUsedBytes: (promVal(results.swapTotal) || 0) - (promVal(results.swapFree) || 0),
      },
      disk: {
        rootTotalBytes: promVal(results.diskTotal) || 0,
        rootFreeBytes: promVal(results.diskFree) || 0,
        rootUsedPercent: promVal(results.diskTotal) > 0
          ? +(((promVal(results.diskTotal) - promVal(results.diskFree)) / promVal(results.diskTotal)) * 100).toFixed(1) : 0,
        mounts,
        io: Object.values(diskIo),
      },
      system: {
        uptimeSeconds: promVal(results.uptime) || 0,
        hostname: hostnameInfo.nodename || '',
        machine: hostnameInfo.machine || '',
        release: hostnameInfo.release || '',
        sysname: hostnameInfo.sysname || '',
      },
    };

    return { simulated: false, metrics };
  } catch (err) {
    logger.warn('[APM] Infrastructure metrics failed: %s', err.message);
    return { simulated: true, metrics: generateFallbackInfra() };
  }
}

function generateFallbackInfra() {
  return {
    cpu: { usagePercent: 23.4, cores: 8, loadAvg: { '1m': 1.82, '5m': 1.54, '15m': 1.31 } },
    memory: { totalBytes: 33554432000, availableBytes: 12884901888, buffersBytes: 5368709120, usedPercent: 61.6, swapTotalBytes: 4294967296, swapUsedBytes: 536870912 },
    disk: { rootTotalBytes: 214748364800, rootFreeBytes: 85899345920, rootUsedPercent: 60.0, mounts: [], io: [] },
    system: { uptimeSeconds: 2592000, hostname: 'server', machine: 'x86_64', release: '6.8.0', sysname: 'Linux' },
  };
}

// ══════════════════════════════════════════════════════════
// 3. Network Interfaces (from Prometheus)
// ══════════════════════════════════════════════════════════

async function getNetworkInterfaces(cfg) {
  const { serverIp, sshPort = 4422, sshUser = 'finadmin', promPort = 30000 } = cfg;
  if (!serverIp) return { simulated: true, interfaces: [] };

  try {
    const queries = {
      rxBytes: 'rate(node_network_receive_bytes_total[5m])',
      txBytes: 'rate(node_network_transmit_bytes_total[5m])',
      rxPackets: 'rate(node_network_receive_packets_total[5m])',
      txPackets: 'rate(node_network_transmit_packets_total[5m])',
      rxErrors: 'rate(node_network_receive_errs_total[5m])',
      txErrors: 'rate(node_network_transmit_errs_total[5m])',
      rxDrop: 'rate(node_network_receive_drop_total[5m])',
      txDrop: 'rate(node_network_transmit_drop_total[5m])',
      speed: 'node_network_speed_bytes',
      info: 'node_network_info',
      up: 'node_network_up',
    };

    const results = await k8s.batchRemotePromQueries(serverIp, queries, sshPort, promPort, sshUser);

    // Build interface map
    const ifaceMap = {};
    const addToIface = (metricResults, field) => {
      for (const item of promAllVals(metricResults)) {
        const dev = item.labels.device;
        if (!dev || dev === 'lo') continue;
        if (!ifaceMap[dev]) ifaceMap[dev] = { name: dev };
        ifaceMap[dev][field] = item.value;
      }
    };

    addToIface(results.rxBytes, 'rxBytesPerSec');
    addToIface(results.txBytes, 'txBytesPerSec');
    addToIface(results.rxPackets, 'rxPacketsPerSec');
    addToIface(results.txPackets, 'txPacketsPerSec');
    addToIface(results.rxErrors, 'rxErrorsPerSec');
    addToIface(results.txErrors, 'txErrorsPerSec');
    addToIface(results.rxDrop, 'rxDropPerSec');
    addToIface(results.txDrop, 'txDropPerSec');
    addToIface(results.speed, 'speedBytes');

    // Add operstate from node_network_up
    for (const item of promAllVals(results.up)) {
      const dev = item.labels.device;
      if (!dev || dev === 'lo') continue;
      if (!ifaceMap[dev]) ifaceMap[dev] = { name: dev };
      ifaceMap[dev].up = item.value === 1;
    }

    // Add info labels
    for (const item of promAllVals(results.info)) {
      const dev = item.labels.device;
      if (!dev || dev === 'lo') continue;
      if (!ifaceMap[dev]) ifaceMap[dev] = { name: dev };
      ifaceMap[dev].operstate = item.labels.operstate;
      ifaceMap[dev].duplex = item.labels.duplex;
      ifaceMap[dev].address = item.labels.address;
    }

    const interfaces = Object.values(ifaceMap).map(iface => ({
      ...iface,
      status: (iface.up === true || iface.operstate === 'up') ? 'UP' : 'DOWN',
      totalBandwidthBps: (iface.rxBytesPerSec || 0) + (iface.txBytesPerSec || 0),
      totalErrorsPerSec: (iface.rxErrorsPerSec || 0) + (iface.txErrorsPerSec || 0) + (iface.rxDropPerSec || 0) + (iface.txDropPerSec || 0),
      utilizationPercent: iface.speedBytes > 0
        ? +(((iface.rxBytesPerSec || 0) + (iface.txBytesPerSec || 0)) / iface.speedBytes * 100).toFixed(1) : null,
    }));

    // Sort: physical first (eth*, ens*, bond*), then virtual
    interfaces.sort((a, b) => {
      const phys = /^(eth|ens|bond|em|enp)/;
      const aPhys = phys.test(a.name) ? 0 : 1;
      const bPhys = phys.test(b.name) ? 0 : 1;
      return aPhys - bPhys || a.name.localeCompare(b.name);
    });

    return { simulated: false, interfaces };
  } catch (err) {
    logger.warn('[APM] Network interfaces failed: %s', err.message);
    return { simulated: true, interfaces: [] };
  }
}

// ══════════════════════════════════════════════════════════
// 4. K8s Cluster Health (from Prometheus kube-state-metrics)
// ══════════════════════════════════════════════════════════

async function getK8sHealth(cfg) {
  const { serverIp, sshPort = 4422, sshUser = 'finadmin', promPort = 30000 } = cfg;
  if (!serverIp) return { simulated: true, k8s: null };

  try {
    const queries = {
      nodesReady: 'kube_node_status_condition{condition="Ready",status="true"}',
      nodesNotReady: 'kube_node_status_condition{condition="Ready",status="false"}',
      podRunning: 'count(kube_pod_status_phase{phase="Running"})',
      podPending: 'count(kube_pod_status_phase{phase="Pending"})',
      podFailed: 'count(kube_pod_status_phase{phase="Failed"})',
      podCrash: 'count(kube_pod_container_status_restarts_total > 5)',
      deployTotal: 'count(kube_deployment_spec_replicas)',
      deployAvail: 'count(kube_deployment_status_replicas_available)',
      deployUnavail: 'sum(kube_deployment_status_replicas_unavailable)',
      containerReady: 'sum(kube_pod_container_status_ready)',
      containerTotal: 'count(kube_pod_container_info)',
      namespacePods: 'count by (namespace) (kube_pod_info)',
    };

    const results = await k8s.batchRemotePromQueries(serverIp, queries, sshPort, promPort, sshUser);

    const nodesReady = (results.nodesReady?.result || []).length;
    const nodesNotReady = (results.nodesNotReady?.result || []).length;
    const podRunning = promVal(results.podRunning) || 0;
    const podPending = promVal(results.podPending) || 0;
    const podFailed = promVal(results.podFailed) || 0;
    const podCrash = promVal(results.podCrash) || 0;

    // Namespace breakdown
    const namespaces = promAllVals(results.namespacePods).map(item => ({
      namespace: item.labels.namespace,
      podCount: item.value,
    })).sort((a, b) => b.podCount - a.podCount);

    return {
      simulated: false,
      k8s: {
        nodes: { ready: nodesReady, notReady: nodesNotReady, total: nodesReady + nodesNotReady },
        pods: { running: podRunning, pending: podPending, failed: podFailed, crashLoop: podCrash, total: podRunning + podPending + podFailed },
        deployments: {
          total: promVal(results.deployTotal) || 0,
          available: promVal(results.deployAvail) || 0,
          unavailable: promVal(results.deployUnavail) || 0,
        },
        containers: {
          ready: promVal(results.containerReady) || 0,
          total: promVal(results.containerTotal) || 0,
        },
        namespaces,
      },
    };
  } catch (err) {
    logger.warn('[APM] K8s health failed: %s', err.message);
    return { simulated: true, k8s: null };
  }
}

// ══════════════════════════════════════════════════════════
// 5. Service Health (key services up/down)
// ══════════════════════════════════════════════════════════

async function getServiceHealth(cfg) {
  const { serverIp, sshPort = 4422, sshUser = 'finadmin', promPort = 30000 } = cfg;
  if (!serverIp) return { simulated: true, services: [] };

  try {
    const queries = {
      upTargets: 'up',
      probeSuccess: 'probe_success',
      probeHttp: 'probe_http_status_code',
      probeDuration: 'probe_duration_seconds',
      probeSslExpiry: 'probe_ssl_earliest_cert_expiry - time()',
      nginxActive: 'nginx_connections_active',
      nginxAccepted: 'rate(nginx_connections_accepted[5m])',
    };

    const results = await k8s.batchRemotePromQueries(serverIp, queries, sshPort, promPort, sshUser);

    // Parse up targets into services
    const services = promAllVals(results.upTargets).map(item => ({
      job: item.labels.job,
      instance: item.labels.instance,
      up: item.value === 1,
      type: categorizeService(item.labels.job),
    }));

    // Add probe results
    const probes = promAllVals(results.probeSuccess);
    const probeHttp = promAllVals(results.probeHttp);
    const probeDuration = promAllVals(results.probeDuration);
    const probeSsl = promAllVals(results.probeSslExpiry);

    const probeServices = probes.map(p => {
      const httpCode = probeHttp.find(h => h.labels.instance === p.labels.instance)?.value || null;
      const duration = probeDuration.find(d => d.labels.instance === p.labels.instance)?.value || null;
      const sslExpiry = probeSsl.find(s => s.labels.instance === p.labels.instance)?.value || null;
      return {
        job: p.labels.job || 'blackbox',
        instance: p.labels.instance,
        up: p.value === 1,
        type: 'probe',
        httpCode: httpCode ? Math.round(httpCode) : null,
        responseTimeMs: duration ? Math.round(duration * 1000) : null,
        sslExpiryDays: sslExpiry ? Math.round(sslExpiry / 86400) : null,
      };
    });

    // Nginx
    const nginx = {
      active: promVal(results.nginxActive) || null,
      acceptedPerSec: promVal(results.nginxAccepted) || null,
    };

    return {
      simulated: false,
      services: [...services, ...probeServices],
      nginx,
    };
  } catch (err) {
    logger.warn('[APM] Service health failed: %s', err.message);
    return { simulated: true, services: [] };
  }
}

function categorizeService(job) {
  if (!job) return 'other';
  const j = job.toLowerCase();
  if (j.includes('node') || j.includes('exporter')) return 'monitoring';
  if (j.includes('prometheus') || j.includes('alertmanager')) return 'monitoring';
  if (j.includes('grafana')) return 'monitoring';
  if (j.includes('kube') || j.includes('k8s')) return 'kubernetes';
  if (j.includes('nginx') || j.includes('ingress')) return 'ingress';
  if (j.includes('redis') || j.includes('mysql') || j.includes('postgres') || j.includes('elastic')) return 'database';
  if (j.includes('rabbit') || j.includes('kafka')) return 'messaging';
  if (j.includes('vault') || j.includes('consul')) return 'security';
  return 'application';
}

// ══════════════════════════════════════════════════════════
// 6. Active Alerts (from AlertManager)
// ══════════════════════════════════════════════════════════

async function getActiveAlerts(cfg) {
  const { serverIp, sshPort = 4422, sshUser = 'finadmin', promPort = 30000 } = cfg;
  if (!serverIp) return { simulated: true, alerts: [] };

  try {
    const result = await k8s.getRemoteFiringAlerts(serverIp, sshPort, promPort, sshUser, 8000);
    const alerts = (result.alerts || []).map(a => ({
      alertname: a.labels?.alertname || 'Unknown',
      severity: a.labels?.severity || 'warning',
      instance: a.labels?.instance || '',
      job: a.labels?.job || '',
      description: a.annotations?.description || a.annotations?.summary || '',
      state: a.state || 'firing',
      activeAt: a.activeAt,
      value: a.value,
      labels: a.labels || {},
    }));
    return { simulated: false, alerts };
  } catch (err) {
    logger.warn('[APM] Active alerts failed: %s', err.message);
    return { simulated: true, alerts: [] };
  }
}

// ══════════════════════════════════════════════════════════
// 7. URL Checker (from Redis)
// ══════════════════════════════════════════════════════════

async function getUrlCheckerStatus(cfg) {
  const { serverIp, sshPort = 4422, sshUser = 'finadmin',
    redisHost = 'localhost', redisPort = 6379, redisPass = '', sites = ['prod'] } = cfg;

  if (!serverIp) return { simulated: true, sites: generateFallbackUrlStatus(sites) };

  try {
    const results = await Promise.allSettled(
      sites.map(async site => {
        const key = `${site}:BOD_URLChecker`;
        const data = await redisGet(serverIp, sshPort, sshUser, redisHost, redisPort, redisPass, key);
        return { site, key, data };
      })
    );
    return { simulated: false, sites: results.map((r, i) => r.status === 'fulfilled' ? r.value : { site: sites[i], data: null }) };
  } catch (err) {
    logger.warn('[APM] URL checker failed: %s', err.message);
    return { simulated: true, sites: generateFallbackUrlStatus(sites) };
  }
}

function generateFallbackUrlStatus(sites) {
  return (sites.length ? sites : ['prod']).map(site => ({
    site, key: `${site}:BOD_URLChecker`,
    data: {
      executedOn: new Date().toISOString(), type: 'table', status: 2,
      data: [
        { url: '/health', name: 'API Health Check', category: 'Core', status: 2, statusCode: 2, httpCode: 200, responseTime: 45 },
        { url: '/metrics', name: 'Metrics Endpoint', category: 'Monitoring', status: 2, statusCode: 2, httpCode: 200, responseTime: 82 },
        { url: '/grafana', name: 'Grafana Dashboard', category: 'Monitoring', status: 2, statusCode: 2, httpCode: 200, responseTime: 120 },
        { url: '/auth/health', name: 'Auth Service', category: 'Auth', status: 1, statusCode: 1, httpCode: 503, responseTime: 4200 },
        { url: '/websocket', name: 'WebSocket Server', category: 'Realtime', status: 2, statusCode: 2, httpCode: 101, responseTime: 18 },
        { url: '/db/health', name: 'Database Check', category: 'Data', status: 2, statusCode: 2, httpCode: 200, responseTime: 31 },
      ].map(u => ({ ...u, sslExpiry: Math.floor(60 + Math.random() * 240), lastCheck: new Date(Date.now() - Math.random() * 120000).toISOString() })),
    },
  }));
}

// ── Summary ─────────────────────────────────────────────

function computeSummary(subsites) {
  let total = 0, healthy = 0, warning = 0, critical = 0, unknown = 0;
  const annotations = [];
  for (const { subsite, groups } of subsites) {
    for (const [groupName, procs] of Object.entries(groups)) {
      for (const proc of procs) {
        total++; if (proc.statusCode === 2) healthy++; else if (proc.statusCode === 1) warning++;
        else if (proc.statusCode === 0) critical++; else unknown++;
        if (proc.statusCode === 0 || proc.statusCode === 1) {
          annotations.push({ id: `${subsite}-${proc.name}`, subsite, group: groupName, process: proc.name,
            statusCode: proc.statusCode, status: proc.status, message: proc.message, lastCheck: proc.lastCheck });
        }
      }
    }
  }
  return { total, healthy, warning, critical, unknown,
    uptime: total > 0 ? +((healthy / total) * 100).toFixed(1) : 100, annotations };
}

module.exports = {
  getProcessStatus, getUrlCheckerStatus, computeSummary,
  getInfrastructureMetrics, getNetworkInterfaces, getK8sHealth,
  getServiceHealth, getActiveAlerts,
  STATUS_MAP,
};
