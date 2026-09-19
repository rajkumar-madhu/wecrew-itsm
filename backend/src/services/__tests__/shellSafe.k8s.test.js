// Shell-injection guards on exec()-built commands (k8sService / apmService).
const mockExec = jest.fn((cmd, opts, cb) => cb(null, { stdout: '{"items":[]}', stderr: '' }));
jest.mock('child_process', () => ({ exec: (...a) => mockExec(...a) }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const k8s = require('../k8sService');
const shellSafe = require('../../utils/shellSafe');

beforeEach(() => mockExec.mockClear());

const INJECTIONS = ['x;id', '$(id)', '`id`', 'a b', "a'b", 'a"b', '-oProxyCommand=id', 'a|b'];

it('refuses injected namespaces before anything is executed', async () => {
  for (const ns of INJECTIONS) {
    await expect(k8s.getNamespacePods('203.0.113.5', ns)).rejects.toThrow(/Unsafe/);
  }
  expect(mockExec).not.toHaveBeenCalled();
});

it('refuses injected pod/container names and label names', async () => {
  await expect(k8s.getPodLogs('203.0.113.5', 'default', '$(id)')).rejects.toThrow(/Unsafe/);
  await expect(k8s.getPodLogs('203.0.113.5', 'default', 'web-1', { container: 'a;b' })).rejects.toThrow(/Unsafe/);
  expect(await k8s.getLokiLabelValues('203.0.113.5', 'job$(id)').catch((e) => e.message)).toMatch(/Unsafe/);
  expect(mockExec).not.toHaveBeenCalled();
});

it('refuses injected ssh host / user / port', () => {
  expect(() => shellSafe.safeHost('-oProxyCommand=id')).toThrow();
  expect(() => shellSafe.safeHost('1.2.3.4;id')).toThrow();
  expect(() => shellSafe.safeUser('root;id')).toThrow();
  expect(() => shellSafe.safePort('22 -o')).toThrow();
  expect(shellSafe.safeHost('10.0.0.5')).toBe('10.0.0.5');
  expect(shellSafe.safeHost('node-1.example.com')).toBe('node-1.example.com');
});

it('still runs a legitimate request', async () => {
  await k8s.getNamespacePods('203.0.113.5', 'fs-linkedeye', 4422, 'finadmin').catch(() => {});
  expect(mockExec).toHaveBeenCalled();
  expect(mockExec.mock.calls[0][0]).toContain('get pods -n fs-linkedeye');
});
