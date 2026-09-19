// ═══════════════════════════════════════════════════════════
// Inbound webhooks: alert senders are bound to an org by token, and Slack
// requests must be signed and may only act inside the linked workspace's org.
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');

const mockPrisma = {
  organization: { findUnique: jest.fn(), findFirst: jest.fn() },
  alert: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
  incident: { updateMany: jest.fn() },
  slackIntegration: { findFirst: jest.fn() },
  user: { findFirst: jest.fn() },
};
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../config/socket', () => ({ emitToAll: jest.fn(), emitToTeam: jest.fn(), emitToUser: jest.fn() }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../config/env', () => ({ config: { slack: { signingSecret: 'slacksecret' } } }));
jest.mock('../../utils/cmdbResolver', () => ({ resolveInstanceToConfigItem: jest.fn(async () => null) }));
jest.mock('../alert.controller', () => ({ buildIncidentFromAlert: jest.fn() }));
jest.mock('../../services/agentPipeline', () => ({ processAlert: jest.fn(async () => {}) }));
jest.mock('../../services/slackService', () => ({ handleSlashCommand: jest.fn(async () => ({ text: 'ok' })) }));

const ctrl = require('../webhook.controller');

function res() {
  const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r;
}
const next = (e) => { throw e; };

beforeEach(() => { jest.clearAllMocks(); delete process.env.ALERT_WEBHOOK_REQUIRE_TOKEN; });

describe('alertmanager webhook', () => {
  const body = { alerts: [{ status: 'resolved', labels: { alertname: 'CPU', instance: '10.0.0.1' } }] };

  it('rejects an unknown token', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    const r = res();
    await ctrl.alertmanagerWebhook({ headers: {}, query: { token: 'bad' }, body, socket: {} }, r, next);
    expect(r.status).toHaveBeenCalledWith(401);
  });

  it('requires a token when ALERT_WEBHOOK_REQUIRE_TOKEN=true', async () => {
    process.env.ALERT_WEBHOOK_REQUIRE_TOKEN = 'true';
    const r = res();
    await ctrl.alertmanagerWebhook({ headers: {}, query: { orgId: 'victim' }, body, socket: {} }, r, next);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(mockPrisma.alert.findFirst).not.toHaveBeenCalled();
  });

  it('does not let a token holder resolve another org\'s alert', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ id: 'acme', isActive: true });
    // A stale row from before the lookup was scoped: the handler must still skip it.
    mockPrisma.alert.findFirst.mockResolvedValue({ id: 'a1', organizationId: 'victim', name: 'CPU' });
    const r = res();
    await ctrl.alertmanagerWebhook({ headers: {}, query: { token: 'whk_acme' }, body, socket: {} }, r, next);
    expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    expect(r.json.mock.calls[0][0].data.results[0].action).toBe('skipped-foreign');
  });
});

describe('slack interactive', () => {
  function signed(payload, { secret = 'slacksecret', ts = Math.floor(Date.now() / 1000) } = {}) {
    const rawBody = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
    const sig = `v0=${crypto.createHmac('sha256', secret).update(`v0:${ts}:${rawBody}`).digest('hex')}`;
    return {
      headers: { 'x-slack-signature': sig, 'x-slack-request-timestamp': String(ts) },
      body: { payload: JSON.stringify(payload) }, rawBody,
    };
  }
  const click = { type: 'block_actions', team: { id: 'T1' }, user: { username: 'x' }, actions: [{ action_id: 'ack_incident_i1' }] };

  it('rejects an unsigned request', async () => {
    const r = res();
    await ctrl.slackInteractive({ headers: {}, body: { payload: JSON.stringify(click) }, rawBody: '' }, r, next);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(mockPrisma.incident.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a replayed (stale) request', async () => {
    const r = res();
    await ctrl.slackInteractive(signed(click, { ts: Math.floor(Date.now() / 1000) - 3600 }), r, next);
    expect(r.status).toHaveBeenCalledWith(401);
  });

  it('refuses a workspace not linked to an org', async () => {
    mockPrisma.slackIntegration.findFirst.mockResolvedValue(null);
    const r = res();
    await ctrl.slackInteractive(signed(click), r, next);
    expect(mockPrisma.incident.updateMany).not.toHaveBeenCalled();
  });

  it('acknowledges only inside the linked org', async () => {
    mockPrisma.slackIntegration.findFirst.mockResolvedValue({ organizationId: 'acme' });
    mockPrisma.incident.updateMany.mockResolvedValue({ count: 1 });
    const r = res();
    await ctrl.slackInteractive(signed(click), r, next);
    expect(mockPrisma.incident.updateMany.mock.calls[0][0].where).toEqual({ id: 'i1', organizationId: 'acme' });
  });
});
