// ═══════════════════════════════════════════════════════════
// Tenant isolation — AI agent, APM, PagerDuty, voice, SMS, agent pipeline.
//
// Each case is a caller in org "acme" (an org ADMIN, not platform staff)
// reaching for something that belongs to org "victim", or a caller with no
// organization reaching for data that used to fall back to "any org".
// ═══════════════════════════════════════════════════════════

const mockPrisma = {
  incident: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  configurationItem: { findUnique: jest.fn() },
  integration: { findFirst: jest.fn(), findMany: jest.fn() },
  organization: { findUnique: jest.fn() },
  user: { findFirst: jest.fn(), count: jest.fn() },
  sMSLog: { findFirst: jest.fn() },
};
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const mockVoiceMakeCall = jest.fn();
jest.mock('../../services/voiceService', () => ({
  makeCall: (...a) => mockVoiceMakeCall(...a),
  resolveCallLanguage: jest.fn(async () => 'en'),
  buildIncidentTwiml: jest.fn(() => '<Response/>'),
  buildOrgGreetingTwiml: jest.fn(() => '<Response/>'),
}));
const mockSmsStatus = jest.fn();
jest.mock('../../services/smsService', () => ({ checkDeliveryStatus: (...a) => mockSmsStatus(...a) }));
const mockPdOverview = jest.fn();
jest.mock('../../services/pagerdutyService', () => ({
  getOverview: (...a) => mockPdOverview(...a),
  parseWebhookEvent: (body) => (body.event ? { type: body.event.event_type, incident: body.event.data } : null),
}));
const mockApm = {};
jest.mock('../../services/apmService', () => new Proxy({}, {
  get: (_t, name) => (...a) => (mockApm[name] ? mockApm[name](...a) : Promise.resolve({ simulated: true })),
}));
const mockGetExecution = jest.fn();
jest.mock('../../services/agentPipeline', () => ({ getExecution: (...a) => mockGetExecution(...a) }));

const ai = require('../aiAgent.controller');
const voice = require('../voice.controller');
const sms = require('../sms.controller');
const pagerduty = require('../pagerduty.controller');
const apmCtrl = require('../apm.controller');
const agent = require('../agentPipeline.controller');
const { NO_TENANT } = require('../../middleware/tenant');

const ORG_ADMIN = { id: 'a', role: 'ADMIN', isPlatformAdmin: false, organizationId: 'acme' };
const acmeReq = (extra = {}) => ({
  user: ORG_ADMIN, organizationId: 'acme', tenantWhere: { organizationId: 'acme' },
  params: {}, query: {}, body: {}, headers: {}, ...extra,
});
const noOrgReq = (extra = {}) => ({
  user: { id: 'v', role: 'VIEWER', isPlatformAdmin: false, organizationId: null },
  organizationId: null, tenantWhere: NO_TENANT, params: {}, query: {}, body: {}, headers: {}, ...extra,
});
function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.set = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}
const statusOf = (res) => (res.status.mock.calls.length ? res.status.mock.calls[0][0] : 200);

beforeEach(() => jest.clearAllMocks());

describe('AI agent', () => {
  it('GET /ai/incidents/:id/resolution-details → 404 for another org\'s incident', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({ id: 'i1', organizationId: 'victim' });
    const res = mockRes();
    await ai.getResolutionDetails(acmeReq({ params: { id: 'i1' } }), res, jest.fn());
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.incident.findMany).not.toHaveBeenCalled(); // related incidents never read
  });

  it('GET /ai/assets/:id/live-metrics and /metrics-history → 404 for another org\'s asset', async () => {
    mockPrisma.configurationItem.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'victim', ipAddress: '10.0.0.1' });
    const r1 = mockRes();
    await ai.getAssetLiveMetrics(acmeReq({ params: { id: 'c1' } }), r1, jest.fn());
    expect(statusOf(r1)).toBe(404);
    const r2 = mockRes();
    await ai.getAssetMetricsHistory(acmeReq({ params: { id: 'c1' } }), r2, jest.fn());
    expect(statusOf(r2)).toBe(404);
  });

  it('a tenant org without its own Prometheus never falls back to the platform one', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue({ serverIp: null });
    mockPrisma.user.count.mockResolvedValue(0); // no platform admin in this org
    expect(await ai.resolvePrometheusAccess('acme')).toEqual({ method: 'none' });
  });

  it('drops shell metacharacters from an org\'s Prometheus SSH config', async () => {
    mockPrisma.integration.findFirst.mockResolvedValue({
      config: JSON.stringify({ accessMethod: 'ssh', serverIp: '1.2.3.4"; rm -rf / #', sshUser: 'x$(id)', sshPort: '22;id' }),
    });
    mockPrisma.organization.findUnique.mockResolvedValue({ serverIp: null });
    const access = await ai.resolvePrometheusAccess('acme');
    expect(access.serverIp).toBeNull();
    expect(access.sshUser).toBe('finadmin');
    expect(access.sshPort).toBe(22); // parseInt stops at ';' — the metacharacter never survives
  });
});

describe('platform-wide AI endpoints', () => {
  const express = require('express');
  const request = require('supertest');

  it('GET /ai/db-analysis → 403 for a non-platform user', async () => {
    jest.resetModules();
    jest.doMock('../../middleware/auth', () => {
      const actual = jest.requireActual('../../middleware/auth');
      return { ...actual, authenticate: (req, _res, next) => { req.user = ORG_ADMIN; next(); } };
    });
    jest.doMock('../../config/redis', () => ({ cacheMiddleware: () => (_q, _s, n) => n() }));
    const routes = require('../../routes/aiAgent.routes');
    const app = express();
    app.use('/api/v1/ai', routes);
    for (const path of ['/db-analysis', '/cluster-health', '/server-analysis', '/log-analysis']) {
      const res = await request(app).get(`/api/v1/ai${path}`);
      expect(res.status).toBe(403);
    }
  });
});

describe('PagerDuty', () => {
  it('a caller with no organization gets no PagerDuty integration (no any-org fallback)', async () => {
    const res = mockRes();
    await pagerduty.getOverview(noOrgReq(), res, jest.fn());
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.integration.findFirst).not.toHaveBeenCalled();
    expect(mockPdOverview).not.toHaveBeenCalled();
  });

  it('POST /pagerduty/webhook without a valid token is rejected and touches nothing', async () => {
    const res = mockRes();
    await pagerduty.handleWebhook({ query: {}, body: { event: { event_type: 'incident.resolved', data: { id: 'P1', title: 'x' } } } }, res);
    expect(statusOf(res)).toBe(401);
    expect(mockPrisma.incident.findFirst).not.toHaveBeenCalled();
  });

  it('POST /pagerduty/webhook with a token only resolves incidents in the owning org', async () => {
    const token = 'a'.repeat(48);
    mockPrisma.integration.findMany.mockResolvedValue([
      { id: 'int1', organizationId: 'acme', config: JSON.stringify({ webhookToken: token }) },
    ]);
    mockPrisma.incident.findFirst.mockResolvedValue(null);
    const res = mockRes();
    await pagerduty.handleWebhook({
      query: { token },
      body: { event: { event_type: 'incident.resolved', data: { id: 'P1', title: 'Disk full' } } },
    }, res);
    expect(statusOf(res)).toBe(200);
    expect(mockPrisma.incident.findFirst.mock.calls[0][0].where).toMatchObject({
      organizationId: 'acme', shortDescription: { contains: 'Disk full' },
    });
  });
});

describe('APM', () => {
  it('a caller with no organization gets no integration config and no SSH target', async () => {
    let seenCfg = null;
    mockApm.getProcessStatus = async (cfg) => { seenCfg = cfg; return { simulated: true, subsites: [] }; };
    await apmCtrl.getOverview(noOrgReq(), mockRes(), jest.fn());
    expect(mockPrisma.integration.findFirst).not.toHaveBeenCalled();
    expect(seenCfg.serverIp).toBeNull();
  });

  it('drops shell metacharacters from an org\'s APM config', async () => {
    mockPrisma.integration.findFirst
      .mockResolvedValueOnce({ config: JSON.stringify({ serverIp: '1.2.3.4', sshUser: 'root;id' }) })
      .mockResolvedValueOnce({ config: JSON.stringify({ redisHost: 'h"; id; "', redisPass: "p'`id`", sites: ['ok-site', 'x;id'] }) });
    mockPrisma.organization.findUnique.mockResolvedValue({ slug: 'acme', serverIp: null });
    let seenCfg = null;
    mockApm.getProcessStatus = async (cfg) => { seenCfg = cfg; return { simulated: true, subsites: [] }; };
    await apmCtrl.getOverview(acmeReq(), mockRes(), jest.fn());
    expect(seenCfg.serverIp).toBe('1.2.3.4');
    expect(seenCfg.sshUser).toBe('finadmin');
    expect(seenCfg.redisHost).toBe('localhost');
    expect(seenCfg.redisPass).toBe('');
    expect(seenCfg.sites).toEqual(['ok-site']);
  });
});

describe('voice', () => {
  it('POST /voice/call with another org\'s incidentId → 404 and no call is placed', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue({ id: 'i1', organizationId: 'victim' });
    const res = mockRes();
    await voice.makeCall(acmeReq({ body: { to: '+919876543210', incidentId: 'i1' } }), res, jest.fn());
    expect(statusOf(res)).toBe(404);
    expect(mockVoiceMakeCall).not.toHaveBeenCalled();
  });

  it('POST /voice/call with raw twiml from a non-platform user → 403', async () => {
    const res = mockRes();
    await voice.makeCall(acmeReq({ body: { to: '+919876543210', twiml: '<Response><Dial>+1</Dial></Response>' } }), res, jest.fn());
    expect(statusOf(res)).toBe(403);
    expect(mockVoiceMakeCall).not.toHaveBeenCalled();
  });
});

describe('SMS', () => {
  it('GET /sms/delivery-status/:messageId → 404 for a message not in the caller\'s logs', async () => {
    mockPrisma.sMSLog.findFirst.mockResolvedValue(null);
    const res = mockRes();
    await sms.checkDeliveryStatus(acmeReq({ params: { messageId: 'SMxyz' } }), res, jest.fn());
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.sMSLog.findFirst.mock.calls[0][0].where).toMatchObject({ organizationId: 'acme', messageId: 'SMxyz' });
    expect(mockSmsStatus).not.toHaveBeenCalled();
  });
});

describe('agent pipeline', () => {
  it('GET /agent/executions/:id → 404 for another org\'s execution', async () => {
    mockGetExecution.mockReturnValue({ id: 'e1', organizationId: 'victim' });
    const res = mockRes();
    await agent.getExecution(acmeReq({ params: { id: 'e1' } }), res, jest.fn());
    expect(statusOf(res)).toBe(404);
  });

  it('a caller with no organization cannot read the global execution log', async () => {
    const res = mockRes();
    await agent.getExecutions(noOrgReq(), res, jest.fn());
    expect(statusOf(res)).toBe(400);
  });
});
