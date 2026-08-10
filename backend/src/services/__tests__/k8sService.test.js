// ═══════════════════════════════════════════════════════════
// k8sService — failure handling
//
// These cover the contract that a code review found broken in three ways at
// once: a partial cluster read presented as a healthy empty cluster, raw
// kubectl/SSH text (bastion user, customer server IP, in-cluster identities)
// echoed into HTTP bodies that any authenticated role can fetch, and metrics
// failures swallowed by `2>/dev/null || echo ""`.
//
// They drive the public functions rather than the private helpers, so they
// describe behaviour callers depend on instead of pinning internals.
// ═══════════════════════════════════════════════════════════

const { promisify } = require('util');

// Each test sets mockExecImpl to decide how a given kubectl invocation settles.
const mockExecImpl = { fn: null };

jest.mock('child_process', () => {
  const { promisify: p } = require('util');
  const exec = () => {
    throw new Error('callback-style exec is not used by k8sService');
  };
  // k8sService does `promisify(exec)` at module load, and Node's real exec
  // carries this symbol to resolve with { stdout, stderr }. Reproduce it so the
  // service sees the shape it expects.
  exec[p.custom] = (cmd) => mockExecImpl.fn(cmd);
  return { exec };
});

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('../../utils/logger');
const k8s = require('../k8sService');

// Realistic kubectl/SSH failures, with the identifiers that must not escape.
const SSH_USER = 'finadmin';
const SERVER_IP = '203.0.113.10';

const FORBIDDEN =
  'Error from server (Forbidden): nodes is forbidden: User "system:serviceaccount:fs-linkedeye:api" cannot list resource "nodes" at the cluster scope';
const UNREACHABLE = 'Unable to connect to the server: dial tcp 10.0.0.1:6443: i/o timeout';

function rejectWith(stderr) {
  return Promise.reject(Object.assign(new Error('Command failed'), { stderr }));
}

const NODES_JSON = JSON.stringify({
  items: [
    {
      metadata: { name: 'node-a', labels: { 'node-role.kubernetes.io/control-plane': '' } },
      status: { conditions: [{ type: 'Ready', status: 'True' }], nodeInfo: {} },
    },
  ],
});

const PODS_JSON = JSON.stringify({
  items: [
    { metadata: { name: 'p1', namespace: 'fs-linkedeye' }, status: { phase: 'Running' }, spec: { containers: [] } },
    { metadata: { name: 'p2', namespace: 'fs-linkedeye' }, status: { phase: 'Failed' }, spec: { containers: [] } },
  ],
});

/** Route each kubectl call to a per-command outcome. */
function withCommands({ nodes, pods, topNodes, topPods }) {
  mockExecImpl.fn = (cmd) => {
    if (cmd.includes('get nodes')) return nodes();
    if (cmd.includes('get pods')) return pods();
    if (cmd.includes('top nodes')) return topNodes();
    if (cmd.includes('top pods')) return topPods();
    throw new Error(`unexpected command: ${cmd}`);
  };
}

const ok = (stdout) => () => Promise.resolve({ stdout, stderr: '' });
const fails = (stderr) => () => rejectWith(stderr);

beforeEach(() => {
  jest.clearAllMocks();
  mockExecImpl.fn = null;
});

describe('promisify wiring', () => {
  it('gives the service a promise-returning exec', async () => {
    const exec = require('child_process').exec;
    mockExecImpl.fn = () => Promise.resolve({ stdout: 'hi', stderr: '' });
    await expect(promisify(exec)('anything')).resolves.toEqual({ stdout: 'hi', stderr: '' });
  });
});

describe('getClusterOverview — healthy cluster', () => {
  it('reports nodes and pods and marks nothing degraded', async () => {
    withCommands({
      nodes: ok(NODES_JSON),
      pods: ok(PODS_JSON),
      topNodes: ok('node-a  120m  6%  1400Mi  18%'),
      topPods: ok(''),
    });

    const overview = await k8s.getClusterOverview(SERVER_IP, 4422, SSH_USER);

    expect(overview.nodeCount).toBe(1);
    expect(overview.nodesReady).toBe(1);
    expect(overview.pods).toEqual({ total: 2, running: 1, pending: 0, failed: 1 });
    expect(overview.nodes[0].cpu).toBe('120m');
    // Absent, not empty — the UI keys off presence to show its warning banner.
    expect(overview.degraded).toBeUndefined();
    expect(overview.warnings).toBeUndefined();
  });
});

describe('getClusterOverview — partial failure', () => {
  it('marks nodes degraded rather than reporting zero nodes', async () => {
    withCommands({
      nodes: fails(FORBIDDEN),
      pods: ok(PODS_JSON),
      topNodes: ok(''),
      topPods: ok(''),
    });

    const overview = await k8s.getClusterOverview(SERVER_IP, 4422, SSH_USER);

    // The bug this guards: nodeCount 0 / nodesReady 0 reads as `0 === 0` → LIVE
    // in syncK8sAssets, writing a healthy zero-node cluster into the CMDB.
    expect(overview.degraded).toContain('nodes');
    expect(overview.warnings).toEqual([expect.stringContaining('nodes:')]);
    // Pod data still came back and is still usable.
    expect(overview.pods.total).toBe(2);
  });

  it('marks pods degraded so an empty pod list is not read as "nothing failing"', async () => {
    withCommands({
      nodes: ok(NODES_JSON),
      pods: fails(FORBIDDEN),
      topNodes: ok(''),
      topPods: ok(''),
    });

    const overview = await k8s.getClusterOverview(SERVER_IP, 4422, SSH_USER);

    expect(overview.degraded).toContain('pods');
    expect(overview.degraded).not.toContain('nodes');
    expect(overview.nodeCount).toBe(1);
  });

  it('treats a metrics failure as non-fatal but still reports it', async () => {
    withCommands({
      nodes: ok(NODES_JSON),
      pods: ok(PODS_JSON),
      topNodes: fails('error: Metrics API not available'),
      topPods: ok(''),
    });

    const overview = await k8s.getClusterOverview(SERVER_IP, 4422, SSH_USER);

    expect(overview.nodeCount).toBe(1);
    expect(overview.degraded).toEqual(['metrics']);
    // Blank CPU/memory columns previously had no explanation anywhere.
    expect(overview.nodes[0].cpu).toBeUndefined();
  });

  it('logs a required failure at error level and an optional one at warn', async () => {
    withCommands({
      nodes: fails(FORBIDDEN),
      pods: ok(PODS_JSON),
      topNodes: fails('error: Metrics API not available'),
      topPods: ok(''),
    });

    await k8s.getClusterOverview(SERVER_IP, 4422, SSH_USER);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('nodes'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('node metrics'));
    // Severity must not disagree between the two lookups for the same condition.
    expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('node metrics'));
  });
});

describe('getClusterOverview — total failure', () => {
  it('throws instead of returning an empty cluster', async () => {
    withCommands({
      nodes: fails(FORBIDDEN),
      pods: fails(UNREACHABLE),
      topNodes: ok(''),
      topPods: ok(''),
    });

    await expect(k8s.getClusterOverview(SERVER_IP, 4422, SSH_USER)).rejects.toThrow();
  });

  it('carries BOTH failure reasons, not just the nodes one', async () => {
    withCommands({
      nodes: fails(FORBIDDEN),
      pods: fails(UNREACHABLE),
      topNodes: ok(''),
      topPods: ok(''),
    });

    const err = await k8s.getClusterOverview(SERVER_IP, 4422, SSH_USER).catch((e) => e);

    // Reporting only the nodes reason sent operators after an RBAC problem
    // while the real cause — the cluster being unreachable — stayed in the log.
    expect(err.message).toContain('nodes:');
    expect(err.message).toContain('pods:');
    expect(err.clientMessage).toContain('denied access');
    expect(err.clientMessage).toContain('could not be reached');
  });
});

describe('client-facing messages never disclose infrastructure detail', () => {
  const leaks = [SSH_USER, SERVER_IP, 'serviceaccount', 'kubectl', 'dial tcp'];

  it('keeps host identity and raw stderr out of clientMessage on a single failure', async () => {
    withCommands({
      nodes: fails(FORBIDDEN),
      pods: fails(FORBIDDEN),
      topNodes: ok(''),
      topPods: ok(''),
    });

    const err = await k8s.getClusterOverview(SERVER_IP, 4422, SSH_USER).catch((e) => e);

    for (const leak of leaks) expect(err.clientMessage).not.toContain(leak);
    // The detail is preserved for the log, just not for the response body.
    expect(err.message).toContain(SSH_USER);
    expect(err.message).toContain(SERVER_IP);
  });

  it('keeps them out of the warnings returned in a 200 body', async () => {
    withCommands({
      nodes: fails(FORBIDDEN),
      pods: ok(PODS_JSON),
      topNodes: ok(''),
      topPods: ok(''),
    });

    const overview = await k8s.getClusterOverview(SERVER_IP, 4422, SSH_USER);

    for (const warning of overview.warnings) {
      for (const leak of leaks) expect(warning).not.toContain(leak);
    }
  });

  it('classifies the common failures into distinct reasons', async () => {
    const cases = [
      [FORBIDDEN, 'denied access'],
      [UNREACHABLE, 'could not be reached'],
      [`${SSH_USER}@${SERVER_IP}: Permission denied (publickey).`, 'connection to the cluster host failed'],
      ['/bin/sh: kubectl: not found', 'kubectl is not available'],
    ];

    for (const [stderr, expected] of cases) {
      withCommands({ nodes: fails(stderr), pods: fails(stderr), topNodes: ok(''), topPods: ok('') });
      const err = await k8s.getClusterOverview(SERVER_IP, 4422, SSH_USER).catch((e) => e);
      expect(err.clientMessage).toContain(expected);
    }
  });
});

describe('getNamespacePods', () => {
  it('throws when the pod lookup fails rather than returning an empty namespace', async () => {
    withCommands({
      nodes: ok(NODES_JSON),
      pods: fails(FORBIDDEN),
      topNodes: ok(''),
      topPods: ok(''),
    });

    const err = await k8s.getNamespacePods(SERVER_IP, 'fs-linkedeye', 4422, SSH_USER).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.clientMessage).toContain('denied access');
    expect(err.clientMessage).not.toContain(SERVER_IP);
  });

  it('still returns pods when only metrics fail', async () => {
    withCommands({
      nodes: ok(NODES_JSON),
      pods: ok(PODS_JSON),
      topNodes: ok(''),
      topPods: fails('error: Metrics API not available'),
    });

    const pods = await k8s.getNamespacePods(SERVER_IP, 'fs-linkedeye', 4422, SSH_USER);

    expect(pods).toHaveLength(2);
    expect(pods[0].cpu).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pod metrics'));
  });
});

describe('metrics commands do not swallow their own stderr', () => {
  // `2>/dev/null || echo ""` forces exit status 0, so execAsync always resolved
  // and a denied metrics-server was indistinguishable from an idle one.
  it('issues kubectl top without a shell-level suppressor', async () => {
    const seen = [];
    mockExecImpl.fn = (cmd) => {
      seen.push(cmd);
      if (cmd.includes('get nodes')) return Promise.resolve({ stdout: NODES_JSON, stderr: '' });
      if (cmd.includes('get pods')) return Promise.resolve({ stdout: PODS_JSON, stderr: '' });
      return Promise.resolve({ stdout: '', stderr: '' });
    };

    await k8s.getClusterOverview(SERVER_IP, 4422, SSH_USER);
    await k8s.getNamespacePods(SERVER_IP, 'fs-linkedeye', 4422, SSH_USER);

    const topCommands = seen.filter((c) => c.includes('top '));
    expect(topCommands.length).toBeGreaterThan(0);
    for (const cmd of topCommands) {
      expect(cmd).not.toContain('2>/dev/null');
      expect(cmd).not.toContain('|| echo');
    }
  });
});
