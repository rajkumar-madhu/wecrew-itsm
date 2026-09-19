const { checkIntegrationConfig, isPrivateIP } = require('../integrationGuard');

const tenant = { platformAdmin: false };

it('classifies private and metadata addresses', () => {
  for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.20.0.1', '192.168.1.1', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
    expect(isPrivateIP(ip)).toBe(true);
  }
  expect(isPrivateIP('8.8.8.8')).toBe(false);
});

it('lets platform admins set anything', async () => {
  expect(await checkIntegrationConfig('{"serverIp":"10.0.0.5","accessMethod":"ssh"}', { platformAdmin: true })).toBeNull();
});

it('blocks a tenant from aiming WeCrew SSH access or the local cluster', async () => {
  expect(await checkIntegrationConfig({ serverIp: '203.0.113.9' }, tenant)).toMatch(/serverIp/);
  expect(await checkIntegrationConfig({ accessMethod: 'local' }, tenant)).toMatch(/accessMethod/);
});

it('blocks SSRF to internal URLs', async () => {
  expect(await checkIntegrationConfig({ prometheusUrl: 'http://169.254.169.254/latest' }, tenant)).toMatch(/public/);
  expect(await checkIntegrationConfig({ k8sApiUrl: 'https://10.43.0.1:443' }, tenant)).toMatch(/public/);
  expect(await checkIntegrationConfig({ grafanaUrl: 'file:///etc/passwd' }, tenant)).toMatch(/http/);
});

it('accepts a public URL and unchanged staff-set fields', async () => {
  expect(await checkIntegrationConfig({ accessMethod: 'direct', k8sApiUrl: 'https://8.8.8.8:6443' }, tenant)).toBeNull();
  const existing = JSON.stringify({ serverIp: '203.0.113.9', sshUser: 'finadmin', prometheusUrl: 'http://10.0.0.5:9090' });
  expect(await checkIntegrationConfig({ serverIp: '203.0.113.9', sshUser: 'finadmin', prometheusUrl: 'http://10.0.0.5:9090', name: 'x' },
    { ...tenant, existing })).toBeNull();
  expect(await checkIntegrationConfig({ serverIp: '198.51.100.7' }, { ...tenant, existing })).toMatch(/serverIp/);
});

it('rejects malformed config', async () => {
  expect(await checkIntegrationConfig('{not json', tenant)).toMatch(/JSON/);
});
