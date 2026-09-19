// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — K8s Cluster Service
// Executes kubectl commands over SSH on remote K8s servers
// SSH key: /home/finadmin/.ssh/id_ed25519 (passwordless)
// ═══════════════════════════════════════════════════════════

const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const axios = require('axios');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

// SSH base command — reuse known_hosts and suppress host key warnings for known servers
// Uses /tmp/.ssh_id_ed25519 (copied at boot with 0600 perms) to avoid K8s secret 0777 symlink issue
const fs = require('fs');
const {
  safeHost, safeUser, safePort, safeInt, safeK8sName, safeLabel, safeDigits, safeUrlPath, safeToken,
} = require('../utils/shellSafe');
const SSH_KEY = fs.existsSync('/tmp/.ssh_id_ed25519') ? '/tmp/.ssh_id_ed25519' : '/home/finadmin/.ssh/id_ed25519';

// Every argument is allowlisted: this string is run by exec() on the API pod.
function sshCmd(serverIp, sshPort = 4422, sshUser = 'finadmin', connectTimeout = 8) {
  serverIp = safeHost(serverIp);
  sshPort = safePort(sshPort, 'sshPort');
  sshUser = safeUser(sshUser);
  connectTimeout = safeInt(connectTimeout, 'connectTimeout', { min: 1, max: 120 });
  return `ssh -p ${sshPort} -i ${SSH_KEY} \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=${connectTimeout} \
    -o BatchMode=yes \
    ${sshUser}@${serverIp}`;
}

// kubectl stderr is kept, not discarded: swallowing it turns "Forbidden" or
// "connection refused" into an empty resource list, which renders as a healthy
// but empty cluster. Failures must reach the caller with their reason.
//
// Two audiences, two messages:
//   err.message       full detail — command, host identity, raw stderr. LOG ONLY.
//   err.clientMessage category-level text, safe for an HTTP body.
// The split is load-bearing. k8s.routes.js mounts every read endpoint behind
// `authenticate` + `tenantContext` with no `authorize(...)`, so a VIEWER can call
// them; raw kubectl/SSH stderr names the bastion SSH user, the customer's server
// IP, the SSH key path on timeout, and in-cluster service-account identities.
const CLIENT_MESSAGES = [
  [/forbidden|cannot list|cannot get|unauthorized|is not allowed/i,
    'The cluster denied access for the configured credentials.'],
  [/unable to connect to the server|connection refused|no route to host|network is unreachable|dial tcp|i\/o timeout/i,
    'The cluster could not be reached.'],
  [/permission denied|host key verification|connection closed by|ssh: /i,
    'The connection to the cluster host failed.'],
  [/command not found|executable file not found|kubectl: not found/i,
    'kubectl is not available on the target host.'],
  [/etimedout|timed out|timeout/i,
    'The cluster request timed out.'],
];

const GENERIC_CLIENT_MESSAGE = 'The cluster request failed.';

function clientMessageFor(text) {
  for (const [pattern, message] of CLIENT_MESSAGES) {
    if (pattern.test(text)) return message;
  }
  return GENERIC_CLIENT_MESSAGE;
}

function kubectlError(cmdDesc, err) {
  const stderr = (err.stderr || '').trim();
  const raw = stderr || err.message || '';
  const detail = raw.trim().split('\n')[0] || 'unknown error';
  const wrapped = new Error(`kubectl ${cmdDesc} failed: ${detail}`, { cause: err });
  wrapped.kubectlStderr = stderr;
  wrapped.clientMessage = clientMessageFor(raw);
  return wrapped;
}

// Both core lookups down: carry both reasons. Throwing only the nodes reason sent
// operators after an RBAC problem while the actionable cause — "unable to connect
// to the server", present only in the pods reason — never left the server log.
function combinedKubectlError(entries) {
  if (entries.length === 1) return entries[0][1];
  const message = entries
    .map(([label, err]) => `${label}: ${err?.message || 'unknown error'}`)
    .join('; ');
  const wrapped = new Error(message);
  wrapped.kubectlStderr = entries
    .map(([label, err]) => `${label}: ${err?.kubectlStderr || '(no stderr)'}`)
    .join('\n');
  const clientParts = [...new Set(entries.map(([, err]) => err?.clientMessage || GENERIC_CLIENT_MESSAGE))];
  wrapped.clientMessage = clientParts.join(' ');
  return wrapped;
}

// One place to classify a settled kubectl result. Both getClusterOverview and
// getNamespacePods route through it so the same condition — a missing
// metrics-server, say — cannot log at error level in one and warn in the other.
// `required: false` means the caller can proceed without it.
function readSettled(label, settled, { required }) {
  if (settled.status === 'fulfilled') return { ok: true, value: settled.value };
  const reason = settled.reason;
  const detail = reason?.kubectlStderr ? `\n${reason.kubectlStderr}` : '';
  const line = `k8s: ${label} lookup failed — ${reason?.message}${detail}`;
  if (required) logger.error(line);
  else logger.warn(line);
  return { ok: false, reason };
}

// Local kubectl (runs directly on the API pod — for the Argus cluster itself)
async function localKubectl(kubectlArgs) {
  try {
    const { stdout } = await execAsync(`kubectl ${kubectlArgs}`, {
      timeout: 20000, maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
    throw kubectlError(`${kubectlArgs} (local)`, err);
  }
}

async function remoteKubectl(serverIp, kubectlArgs, sshPort = 4422, sshUser = 'finadmin') {
  try {
    const cmd = `${sshCmd(serverIp, sshPort, sshUser)} "kubectl ${kubectlArgs}"`;
    const { stdout } = await execAsync(cmd, { timeout: 15000, maxBuffer: 10 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    throw kubectlError(`${kubectlArgs} (${sshUser}@${serverIp})`, err);
  }
}

// Unified kubectl — uses local or remote based on whether serverIp is provided
async function kubectl(kubectlArgs, serverIp, sshPort, sshUser) {
  if (!serverIp || serverIp === 'local') {
    return localKubectl(kubectlArgs);
  }
  return remoteKubectl(serverIp, kubectlArgs, sshPort, sshUser);
}

// ── Cluster Overview ─────────────────────────────────────

async function getClusterOverview(serverIp, sshPort = 4422, sshUser = 'finadmin') {
  const [nodesRaw, podsRaw, metricsRaw] = await Promise.allSettled([
    kubectl('get nodes -o json', serverIp, sshPort, sshUser),
    kubectl('get pods --all-namespaces -o json', serverIp, sshPort, sshUser),
    // No `2>/dev/null || echo ""` here. `|| echo ""` forces shell exit status 0, so
    // a denied or absent metrics-server resolved as an empty string: every node came
    // back with blank CPU/memory and nothing anywhere said why. Let it reject —
    // readSettled marks it optional, so the failure is reported, not fatal.
    kubectl('top nodes --no-headers', serverIp, sshPort, sshUser),
  ]);

  const nodesRes = readSettled('nodes', nodesRaw, { required: true });
  const podsRes = readSettled('pods', podsRaw, { required: true });
  const metricsRes = readSettled('node metrics', metricsRaw, { required: false });

  // Both core lookups down means the cluster is unreachable or access is denied —
  // that is an error, not an empty cluster.
  if (!nodesRes.ok && !podsRes.ok) {
    throw combinedKubectlError([['nodes', nodesRes.reason], ['pods', podsRes.reason]]);
  }

  // One core lookup down is reported as a degraded response rather than a hard
  // failure, so an operator can still read node health while pods are denied.
  // `degraded` is the machine-readable half: syncK8sAssets refuses to write the
  // CMDB from a partial overview, and the dashboard labels the affected panels.
  const degraded = [];
  const warnings = [];
  for (const [label, res] of [['nodes', nodesRes], ['pods', podsRes], ['metrics', metricsRes]]) {
    if (!res.ok) {
      degraded.push(label);
      warnings.push(`${label}: ${res.reason?.clientMessage || GENERIC_CLIENT_MESSAGE}`);
    }
  }

  const nodes = nodesRes.ok ? JSON.parse(nodesRes.value).items || [] : [];
  const pods = podsRes.ok ? JSON.parse(podsRes.value).items || [] : [];

  // Parse node metrics (kubectl top nodes --no-headers output)
  const nodeMetrics = {};
  if (metricsRes.ok && metricsRes.value) {
    for (const line of metricsRes.value.split('\n').filter(Boolean)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        nodeMetrics[parts[0]] = { cpu: parts[1], cpuPct: parts[2], mem: parts[3], memPct: parts[4] };
      }
    }
  }

  const nodeList = nodes.map(n => {
    const conditions = n.status?.conditions || [];
    const ready = conditions.find(c => c.type === 'Ready')?.status === 'True';
    const name = n.metadata?.name;
    return {
      name,
      status: ready ? 'Ready' : 'NotReady',
      roles: Object.keys(n.metadata?.labels || {})
        .filter(k => k.startsWith('node-role.kubernetes.io/'))
        .map(k => k.replace('node-role.kubernetes.io/', '')).join(', ') || 'worker',
      age: n.metadata?.creationTimestamp,
      kubeletVersion: n.status?.nodeInfo?.kubeletVersion,
      os: n.status?.nodeInfo?.osImage,
      arch: n.status?.nodeInfo?.architecture,
      cpu: nodeMetrics[name]?.cpu,
      cpuPct: nodeMetrics[name]?.cpuPct,
      mem: nodeMetrics[name]?.mem,
      memPct: nodeMetrics[name]?.memPct,
    };
  });

  // Pod summary by namespace
  const nsSummary = {};
  let totalRunning = 0, totalPending = 0, totalFailed = 0;
  for (const pod of pods) {
    const ns = pod.metadata?.namespace || 'unknown';
    const phase = pod.status?.phase || 'Unknown';
    if (!nsSummary[ns]) nsSummary[ns] = { total: 0, running: 0, pending: 0, failed: 0 };
    nsSummary[ns].total++;
    if (phase === 'Running') { nsSummary[ns].running++; totalRunning++; }
    else if (phase === 'Pending') { nsSummary[ns].pending++; totalPending++; }
    else if (phase === 'Failed') { nsSummary[ns].failed++; totalFailed++; }
  }

  return {
    nodes: nodeList,
    nodeCount: nodeList.length,
    nodesReady: nodeList.filter(n => n.status === 'Ready').length,
    pods: { total: pods.length, running: totalRunning, pending: totalPending, failed: totalFailed },
    namespaces: nsSummary,
    // Present only on partial failure, so the UI can say why a section is empty
    // and syncK8sAssets can refuse to persist it. `warnings` carries the
    // client-safe reasons; `degraded` names the sections that are not trustworthy.
    ...(degraded.length ? { degraded, warnings } : {}),
  };
}

// ── Namespace Detail ─────────────────────────────────────

async function getNamespacePods(serverIp, namespace = 'fs-linkedeye', sshPort = 4422, sshUser = 'finadmin') {
  namespace = safeK8sName(namespace);
  const [podsRaw, metricsRaw] = await Promise.allSettled([
    kubectl(`get pods -n ${namespace} -o json`, serverIp, sshPort, sshUser),
    // See getClusterOverview: no `2>/dev/null || echo ""`, or the failure is invisible.
    kubectl(`top pods -n ${namespace} --no-headers`, serverIp, sshPort, sshUser),
  ]);

  const podsRes = readSettled(`pods in ${namespace}`, podsRaw, { required: true });
  const metricsRes = readSettled(`pod metrics in ${namespace}`, metricsRaw, { required: false });

  // A failed pod lookup is an error, not an empty namespace.
  if (!podsRes.ok) throw podsRes.reason;

  const pods = JSON.parse(podsRes.value).items || [];

  // Parse pod metrics
  const podMetrics = {};
  if (metricsRes.ok && metricsRes.value) {
    for (const line of metricsRes.value.split('\n').filter(Boolean)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) podMetrics[parts[0]] = { cpu: parts[1], mem: parts[2] };
    }
  }

  return pods.map(p => {
    const name = p.metadata?.name;
    const containers = p.spec?.containers || [];
    const statuses = p.status?.containerStatuses || [];
    const ready = statuses.every(c => c.ready);
    const restarts = statuses.reduce((sum, c) => sum + (c.restartCount || 0), 0);
    return {
      name,
      namespace: p.metadata?.namespace,
      phase: p.status?.phase,
      ready,
      restarts,
      age: p.metadata?.creationTimestamp,
      hostIp: p.status?.hostIP,
      podIp: p.status?.podIP,
      containers: containers.map(c => c.name),
      cpu: podMetrics[name]?.cpu,
      mem: podMetrics[name]?.mem,
    };
  });
}

// ── Deployments ──────────────────────────────────────────

async function getDeployments(serverIp, namespace = 'fs-linkedeye', sshPort = 4422, sshUser = 'finadmin') {
  namespace = safeK8sName(namespace);
  const raw = await kubectl(`get deployments -n ${namespace} -o json`, serverIp, sshPort, sshUser);
  const items = JSON.parse(raw).items || [];
  return items.map(d => ({
    name: d.metadata?.name,
    namespace: d.metadata?.namespace,
    replicas: d.spec?.replicas || 0,
    readyReplicas: d.status?.readyReplicas || 0,
    availableReplicas: d.status?.availableReplicas || 0,
    age: d.metadata?.creationTimestamp,
    healthy: (d.status?.readyReplicas || 0) === (d.spec?.replicas || 0),
  }));
}

// ── Events (warnings) ────────────────────────────────────

async function getWarningEvents(serverIp, namespace = 'fs-linkedeye', sshPort = 4422, sshUser = 'finadmin') {
  namespace = safeK8sName(namespace);
  const raw = await kubectl(
    `get events -n ${namespace} --field-selector type=Warning -o json --sort-by=.lastTimestamp`,
    serverIp, sshPort, sshUser
  );
  const items = JSON.parse(raw).items || [];
  return items.slice(-20).reverse().map(e => ({
    name: e.involvedObject?.name,
    kind: e.involvedObject?.kind,
    reason: e.reason,
    message: e.message,
    count: e.count,
    firstTime: e.firstTimestamp,
    lastTime: e.lastTimestamp,
  }));
}

// ── Services ─────────────────────────────────────────────

async function getServices(serverIp, namespace = 'fs-linkedeye', sshPort = 4422, sshUser = 'finadmin') {
  namespace = safeK8sName(namespace);
  const raw = await kubectl(`get svc -n ${namespace} -o json`, serverIp, sshPort, sshUser);
  const items = JSON.parse(raw).items || [];
  return items.map(s => ({
    name: s.metadata?.name,
    type: s.spec?.type,
    clusterIp: s.spec?.clusterIP,
    ports: (s.spec?.ports || []).map(p => `${p.port}:${p.nodePort || '-'}/${p.protocol}`).join(', '),
    age: s.metadata?.creationTimestamp,
  }));
}

// ── Direct K8s API Access (no SSH) ───────────────────────
// Supports Bearer token (service account) or Basic Auth (username/password)
// TLS verification is disabled — most internal K8s clusters use self-signed certs.

function buildK8sApiClient(apiUrl, auth) {
  const headers = {};
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  } else if (auth.username && auth.password) {
    const b64 = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
    headers.Authorization = `Basic ${b64}`;
  }
  return axios.create({
    baseURL: apiUrl.replace(/\/+$/, ''),
    headers,
    timeout: 15000,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  });
}

async function getClusterOverviewDirect(apiUrl, auth) {
  const client = buildK8sApiClient(apiUrl, auth);
  const [nodesResp, podsResp] = await Promise.allSettled([
    client.get('/api/v1/nodes'),
    client.get('/api/v1/pods'),
  ]);

  const nodes = nodesResp.status === 'fulfilled' ? (nodesResp.value.data.items || []) : [];
  const pods  = podsResp.status  === 'fulfilled' ? (podsResp.value.data.items  || []) : [];

  const nodeList = nodes.map(n => {
    const conditions = n.status?.conditions || [];
    const ready = conditions.find(c => c.type === 'Ready')?.status === 'True';
    const name = n.metadata?.name;
    return {
      name,
      status: ready ? 'Ready' : 'NotReady',
      roles: Object.keys(n.metadata?.labels || {})
        .filter(k => k.startsWith('node-role.kubernetes.io/'))
        .map(k => k.replace('node-role.kubernetes.io/', '')).join(', ') || 'worker',
      age: n.metadata?.creationTimestamp,
      kubeletVersion: n.status?.nodeInfo?.kubeletVersion,
      os: n.status?.nodeInfo?.osImage,
      arch: n.status?.nodeInfo?.architecture,
    };
  });

  const nsSummary = {};
  let totalRunning = 0, totalPending = 0, totalFailed = 0;
  for (const pod of pods) {
    const ns = pod.metadata?.namespace || 'unknown';
    const phase = pod.status?.phase || 'Unknown';
    if (!nsSummary[ns]) nsSummary[ns] = { total: 0, running: 0, pending: 0, failed: 0 };
    nsSummary[ns].total++;
    if (phase === 'Running')      { nsSummary[ns].running++; totalRunning++; }
    else if (phase === 'Pending') { nsSummary[ns].pending++; totalPending++; }
    else if (phase === 'Failed')  { nsSummary[ns].failed++;  totalFailed++;  }
  }

  return {
    nodes: nodeList,
    nodeCount: nodeList.length,
    nodesReady: nodeList.filter(n => n.status === 'Ready').length,
    pods: { total: pods.length, running: totalRunning, pending: totalPending, failed: totalFailed },
    namespaces: nsSummary,
  };
}

async function getNamespacePodsDirect(apiUrl, namespace, auth) {
  namespace = safeK8sName(namespace);
  const client = buildK8sApiClient(apiUrl, auth);
  const resp = await client.get(`/api/v1/namespaces/${namespace}/pods`);
  return (resp.data.items || []).map(p => {
    const name = p.metadata?.name;
    const statuses = p.status?.containerStatuses || [];
    return {
      name,
      namespace: p.metadata?.namespace,
      phase: p.status?.phase,
      ready: statuses.every(c => c.ready),
      restarts: statuses.reduce((s, c) => s + (c.restartCount || 0), 0),
      age: p.metadata?.creationTimestamp,
      hostIp: p.status?.hostIP,
      podIp: p.status?.podIP,
      containers: (p.spec?.containers || []).map(c => c.name),
    };
  });
}

async function getDeploymentsDirect(apiUrl, namespace, auth) {
  namespace = safeK8sName(namespace);
  const client = buildK8sApiClient(apiUrl, auth);
  const resp = await client.get(`/apis/apps/v1/namespaces/${namespace}/deployments`);
  return (resp.data.items || []).map(d => ({
    name: d.metadata?.name,
    namespace: d.metadata?.namespace,
    replicas: d.spec?.replicas || 0,
    readyReplicas: d.status?.readyReplicas || 0,
    availableReplicas: d.status?.availableReplicas || 0,
    age: d.metadata?.creationTimestamp,
    healthy: (d.status?.readyReplicas || 0) === (d.spec?.replicas || 0),
  }));
}

async function getWarningEventsDirect(apiUrl, namespace, auth) {
  namespace = safeK8sName(namespace);
  const client = buildK8sApiClient(apiUrl, auth);
  const resp = await client.get(`/api/v1/namespaces/${namespace}/events`, {
    params: { fieldSelector: 'type=Warning' },
  });
  return (resp.data.items || []).slice(-20).reverse().map(e => ({
    name: e.involvedObject?.name,
    kind: e.involvedObject?.kind,
    reason: e.reason,
    message: e.message,
    count: e.count,
    firstTime: e.firstTimestamp,
    lastTime: e.lastTimestamp,
  }));
}

async function getServicesDirect(apiUrl, namespace, auth) {
  namespace = safeK8sName(namespace);
  const client = buildK8sApiClient(apiUrl, auth);
  const resp = await client.get(`/api/v1/namespaces/${namespace}/services`);
  return (resp.data.items || []).map(s => ({
    name: s.metadata?.name,
    type: s.spec?.type,
    clusterIp: s.spec?.clusterIP,
    ports: (s.spec?.ports || []).map(p => `${p.port}:${p.nodePort || '-'}/${p.protocol}`).join(', '),
    age: s.metadata?.creationTimestamp,
  }));
}

// ── Batch Remote Prometheus Queries ─────────────────────
// Runs all PromQL queries in a single SSH round-trip via Python3 on the remote host

async function batchRemotePromQueries(serverIp, queryMap, sshPort = 4422, promPort = 30000, sshUser = 'finadmin') {
  promPort = safePort(promPort, 'promPort');
  const pyScript = [
    'import json,urllib.request,urllib.parse,sys,base64',
    'queries=json.loads(base64.b64decode(sys.argv[1]).decode())',
    'results={}',
    'for label,query in queries.items():',
    '  try:',
    `    url="http://localhost:${promPort}/api/v1/query?"+urllib.parse.urlencode({"query":query})`,
    '    resp=urllib.request.urlopen(url,timeout=3)',
    '    data=json.loads(resp.read())',
    '    results[label]=data.get("data",{"resultType":"vector","result":[]}) if data.get("status")=="success" else {"resultType":"vector","result":[]}',
    '  except:',
    '    results[label]={"resultType":"vector","result":[]}',
    'print(json.dumps(results))',
  ].join('\n');

  const scriptB64 = Buffer.from(pyScript).toString('base64');
  const queriesB64 = Buffer.from(JSON.stringify(queryMap)).toString('base64');

  const cmd = `${sshCmd(serverIp, sshPort, sshUser, 4)} "echo '${scriptB64}' | base64 -d | python3 - '${queriesB64}'"`;

  try {
    const { stdout } = await execAsync(cmd, { timeout: 8000, maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout.trim());
  } catch (err) {
    logger.warn(`[K8s] Remote Prometheus batch query failed for ${serverIp}: ${err.message}`);
    const empty = {};
    for (const label of Object.keys(queryMap)) {
      empty[label] = { resultType: 'vector', result: [] };
    }
    return empty;
  }
}

// Fetch firing alerts from remote Prometheus
// Returns { alerts, fetchError } — fetchError is set when SSH/network fails.
// Callers MUST check fetchError before treating empty alerts as "nothing firing".
async function getRemoteFiringAlerts(serverIp, sshPort = 4422, promPort = 30000, sshUser = 'finadmin', timeout = 15000) {
  promPort = safePort(promPort, 'promPort');
  const connectTimeout = timeout <= 8000 ? 4 : 8;
  const cmd = `${sshCmd(serverIp, sshPort, sshUser, connectTimeout)} "curl -sf http://localhost:${promPort}/api/v1/alerts 2>/dev/null || echo '{}'"`;
  try {
    const { stdout } = await execAsync(cmd, { timeout, maxBuffer: 10 * 1024 * 1024 });
    const data = JSON.parse(stdout.trim());
    if (data.status === 'success') {
      return { alerts: (data.data?.alerts || []).filter(a => a.state === 'firing'), fetchError: null };
    }
    return { alerts: [], fetchError: null };
  } catch (err) {
    logger.warn(`[K8s] Remote alerts fetch failed for ${serverIp}: ${err.message}`);
    return { alerts: [], fetchError: err.message };
  }
}

// Fetch Grafana API endpoint via SSH (for remote orgs behind firewall)
async function remoteGrafanaApi(serverIp, grafanaPort, apiPath, apiKey, sshPort = 4422, sshUser = 'finadmin') {
  grafanaPort = safePort(grafanaPort, 'grafanaPort');
  apiPath = safeUrlPath(apiPath);
  if (apiKey) safeToken(apiKey);
  const authHeader = apiKey ? `-H 'Authorization: Bearer ${apiKey}'` : '';
  const cmd = `${sshCmd(serverIp, sshPort, sshUser)} "curl -sf ${authHeader} 'http://${serverIp}:${grafanaPort}${apiPath}' 2>/dev/null || echo '[]'"`;
  try {
    const { stdout } = await execAsync(cmd, { timeout: 15000, maxBuffer: 5 * 1024 * 1024 });
    return JSON.parse(stdout.trim());
  } catch (err) {
    logger.warn(`[K8s] Remote Grafana API call failed for ${serverIp}: ${err.message}`);
    return null;
  }
}

// ── Batch Remote Prometheus Range Queries ─────────────────
// Like batchRemotePromQueries but uses /api/v1/query_range

async function batchRemotePromRangeQueries(serverIp, queryMap, start, end, step, sshPort = 4422, promPort = 30000, sshUser = 'finadmin') {
  promPort = safePort(promPort, 'promPort');
  const pyScript = [
    'import json,urllib.request,urllib.parse,sys,base64',
    'args=json.loads(base64.b64decode(sys.argv[1]).decode())',
    'queries=args["queries"]',
    `start=args["start"]`,
    `end=args["end"]`,
    `step=args["step"]`,
    'results={}',
    'for label,query in queries.items():',
    '  try:',
    `    url="http://localhost:${promPort}/api/v1/query_range?"+urllib.parse.urlencode({"query":query,"start":start,"end":end,"step":step})`,
    '    resp=urllib.request.urlopen(url,timeout=15)',
    '    data=json.loads(resp.read())',
    '    results[label]=data.get("data",{"resultType":"matrix","result":[]}) if data.get("status")=="success" else {"resultType":"matrix","result":[]}',
    '  except:',
    '    results[label]={"resultType":"matrix","result":[]}',
    'print(json.dumps(results))',
  ].join('\n');

  const scriptB64 = Buffer.from(pyScript).toString('base64');
  const argsB64 = Buffer.from(JSON.stringify({ queries: queryMap, start, end, step })).toString('base64');

  const cmd = `${sshCmd(serverIp, sshPort, sshUser)} "echo '${scriptB64}' | base64 -d | python3 - '${argsB64}'"`;

  try {
    const { stdout } = await execAsync(cmd, { timeout: 45000, maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout.trim());
  } catch (err) {
    logger.warn(`[K8s] Remote Prometheus range query failed for ${serverIp}: ${err.message}`);
    const empty = {};
    for (const label of Object.keys(queryMap)) {
      empty[label] = { resultType: 'matrix', result: [] };
    }
    return empty;
  }
}

// ── Pod Logs ────────────────────────────────────────────

async function getPodLogs(serverIp, namespace, podName, options = {}, sshPort = 4422, sshUser = 'finadmin') {
  const { container, tailLines = 200, sinceSeconds, previous } = options;
  namespace = safeK8sName(namespace);
  podName = safeK8sName(podName, 'pod');
  if (container) safeK8sName(container, 'container');
  safeInt(tailLines, 'tail', { min: 1, max: 10000 });
  if (sinceSeconds) safeInt(sinceSeconds, 'since', { min: 1 });
  let args = `logs ${podName} -n ${namespace} --tail=${tailLines} --timestamps`;
  if (container) args += ` -c ${container}`;
  if (sinceSeconds) args += ` --since=${sinceSeconds}s`;
  if (previous) args += ' --previous';

  const raw = await kubectl(args, serverIp, sshPort, sshUser);
  return raw.split('\n').filter(Boolean).map(line => {
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx > 0) {
      return { timestamp: line.slice(0, spaceIdx), message: line.slice(spaceIdx + 1) };
    }
    return { timestamp: null, message: line };
  });
}

async function getPodLogsDirect(apiUrl, namespace, podName, options = {}, auth = {}) {
  namespace = safeK8sName(namespace);
  podName = safeK8sName(podName, 'pod');
  if (options.container) safeK8sName(options.container, 'container');
  const { container, tailLines = 200, sinceSeconds, previous } = options;
  const client = buildK8sApiClient(apiUrl, auth);
  const params = { tailLines, timestamps: true };
  if (container) params.container = container;
  if (sinceSeconds) params.sinceSeconds = sinceSeconds;
  if (previous) params.previous = true;

  const resp = await client.get(`/api/v1/namespaces/${namespace}/pods/${podName}/log`, { params });
  const raw = resp.data || '';
  return raw.split('\n').filter(Boolean).map(line => {
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx > 0) {
      return { timestamp: line.slice(0, spaceIdx), message: line.slice(spaceIdx + 1) };
    }
    return { timestamp: null, message: line };
  });
}

// ── Loki Log Queries (SSH-proxied) ───────────────────────

async function queryLokiLogs(serverIp, lokiQuery, options = {}, sshPort = 4422, lokiPort = 3100, sshUser = 'finadmin') {
  const { start, end, limit = 500, direction = 'backward' } = options;
  lokiPort = safePort(lokiPort, 'lokiPort');
  // lokiQuery is safe: URLSearchParams percent-encodes quotes, $, backticks.
  if (start) safeDigits(start, 'start');
  if (end) safeDigits(end, 'end');
  safeInt(limit, 'limit', { min: 1, max: 5000 });
  if (!['backward', 'forward'].includes(direction)) throw Object.assign(new Error('Unsafe value for direction'), { clientMessage: 'Invalid direction.' });
  const now = Date.now() * 1_000_000; // nanoseconds
  const params = new URLSearchParams({
    query: lokiQuery,
    limit: String(limit),
    direction,
    start: start || String(now - 3600 * 1e9),
    end: end || String(now),
  });

  const cmd = `${sshCmd(serverIp, sshPort, sshUser, 8)} "curl -sf --max-time 10 'http://localhost:${lokiPort}/loki/api/v1/query_range?${params}' 2>&1"`;
  try {
    const { stdout } = await execAsync(cmd, { timeout: 15000, maxBuffer: 10 * 1024 * 1024 });
    const raw = stdout.trim();
    if (!raw) {
      return { logs: [], total: 0, error: `Loki not reachable on ${serverIp}:${lokiPort}` };
    }
    let data;
    try { data = JSON.parse(raw); } catch {
      return { logs: [], total: 0, error: `Loki returned non-JSON response: ${raw.slice(0, 120)}` };
    }
    if (data.status === 'success' && data.data?.result) {
      const logs = [];
      for (const stream of data.data.result) {
        const labels = stream.stream || {};
        for (const [ts, line] of (stream.values || [])) {
          logs.push({ timestamp: ts, message: line, labels });
        }
      }
      // Sort by timestamp string (nanoseconds — lexicographic is safe for same-length strings)
      logs.sort((a, b) => direction === 'backward'
        ? b.timestamp.localeCompare(a.timestamp)
        : a.timestamp.localeCompare(b.timestamp));
      return { logs: logs.slice(0, limit), total: logs.length };
    }
    const lokiError = data.error || data.message || 'Loki returned no results';
    return { logs: [], total: 0, error: lokiError };
  } catch (err) {
    logger.warn(`[K8s] Loki query failed for ${serverIp}: ${err.message}`);
    return { logs: [], total: 0, error: err.message };
  }
}

async function getLokiLabels(serverIp, sshPort = 4422, lokiPort = 3100, sshUser = 'finadmin') {
  lokiPort = safePort(lokiPort, 'lokiPort');
  const cmd = `${sshCmd(serverIp, sshPort, sshUser, 5)} "curl -sf 'http://localhost:${lokiPort}/loki/api/v1/labels' 2>/dev/null || echo '{}'"`;
  try {
    const { stdout } = await execAsync(cmd, { timeout: 8000, maxBuffer: 1024 * 1024 });
    const data = JSON.parse(stdout.trim());
    return data.status === 'success' ? (data.data || []) : [];
  } catch (err) {
    logger.warn(`[K8s] Loki labels fetch failed for ${serverIp}: ${err.message}`);
    return [];
  }
}

async function getLokiLabelValues(serverIp, labelName, sshPort = 4422, lokiPort = 3100, sshUser = 'finadmin') {
  labelName = safeLabel(labelName);
  lokiPort = safePort(lokiPort, 'lokiPort');
  const cmd = `${sshCmd(serverIp, sshPort, sshUser, 5)} "curl -sf 'http://localhost:${lokiPort}/loki/api/v1/label/${labelName}/values' 2>/dev/null || echo '{}'"`;
  try {
    const { stdout } = await execAsync(cmd, { timeout: 8000, maxBuffer: 1024 * 1024 });
    const data = JSON.parse(stdout.trim());
    return data.status === 'success' ? (data.data || []) : [];
  } catch (err) {
    logger.warn(`[K8s] Loki label values fetch failed for ${serverIp}: ${err.message}`);
    return [];
  }
}

module.exports = {
  // SSH-based
  getClusterOverview, getNamespacePods, getDeployments, getWarningEvents, getServices,
  batchRemotePromQueries, batchRemotePromRangeQueries, getRemoteFiringAlerts, remoteGrafanaApi,
  getPodLogs, queryLokiLogs, getLokiLabels, getLokiLabelValues,
  // Direct K8s API (no SSH)
  getClusterOverviewDirect, getNamespacePodsDirect, getDeploymentsDirect,
  getWarningEventsDirect, getServicesDirect, getPodLogsDirect,
};
