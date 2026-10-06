// Attachments: tenant-scoped via the parent ticket, role-checked, never public.
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');

const UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'att-test-'));
process.env.UPLOAD_DIR = UPLOAD_DIR;

const OWN_INC = '11111111-1111-4111-8111-111111111111';
const OTHER_INC = '22222222-2222-4222-8222-222222222222';
const ATT_ID = '33333333-3333-4333-8333-333333333333';

let mockUser;
const mockPrisma = {
  incident: { findFirst: jest.fn() },
  change: { findFirst: jest.fn() },
  problem: { findFirst: jest.fn() },
  attachment: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn((a) => a), delete: jest.fn(async () => ({})) },
  $transaction: jest.fn(async (ops) => ops.map((o) => ({ id: 'new', ...o.data }))),
};
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../middleware/billing.middleware', () => ({ enforceWriteAccess: (_q, _s, n) => n() }));
jest.mock('../../middleware/auth', () => {
  const actual = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req, _res, next) => { req.user = mockUser; req.tenantWhere = { organizationId: 'org1' }; next(); },
  };
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/attachments', require('../attachment.routes'));
  return app;
}

const filesOnDisk = () => fs.readdirSync(UPLOAD_DIR);

beforeEach(() => {
  jest.clearAllMocks();
  for (const f of filesOnDisk()) fs.unlinkSync(path.join(UPLOAD_DIR, f));
  mockUser = { id: 'eng1', role: 'ENGINEER', organizationId: 'org1' };
  // Only OWN_INC is inside the caller's tenant.
  mockPrisma.incident.findFirst.mockImplementation(async ({ where }) =>
    (where.id === OWN_INC && where.organizationId === 'org1' ? { id: OWN_INC } : null));
});
afterAll(() => fs.rmSync(UPLOAD_DIR, { recursive: true, force: true }));

describe('upload', () => {
  it('stores the file under a random name with an extension from its type', async () => {
    const res = await request(buildApp())
      .post(`/api/v1/attachments/incidents/${OWN_INC}`)
      .attach('files', Buffer.from('disk full on node-3'), { filename: '../../evil name.txt', contentType: 'text/plain' });
    expect(res.status).toBe(201);
    const [stored] = filesOnDisk();
    expect(stored).toMatch(/^[0-9a-f-]{36}\.txt$/);
    expect(res.body.data[0]).toMatchObject({ originalName: 'evil name.txt', mimeType: 'text/plain', incidentId: OWN_INC });
  });

  it("writes nothing for another org's ticket", async () => {
    const res = await request(buildApp())
      .post(`/api/v1/attachments/incidents/${OTHER_INC}`)
      .attach('files', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(404);
    expect(filesOnDisk()).toHaveLength(0);
  });

  it('refuses viewers', async () => {
    mockUser = { id: 'v1', role: 'VIEWER', organizationId: 'org1' };
    const res = await request(buildApp())
      .post(`/api/v1/attachments/incidents/${OWN_INC}`)
      .attach('files', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(403);
    expect(filesOnDisk()).toHaveLength(0);
  });

  it('refuses a type outside the allow-list with a readable 400', async () => {
    const res = await request(buildApp())
      .post(`/api/v1/attachments/incidents/${OWN_INC}`)
      .attach('files', Buffer.from('<script>alert(1)</script>'), { filename: 'x.html', contentType: 'text/html' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/);
  });

  it('removes the written files if the database write fails', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('db down'));
    const app = buildApp();
    app.use((err, _req, res, _next) => res.status(500).json({ error: err.message })); // eslint-disable-line no-unused-vars
    const res = await request(app)
      .post(`/api/v1/attachments/incidents/${OWN_INC}`)
      .attach('files', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(500);
    expect(filesOnDisk()).toHaveLength(0);
  });
});

describe('download and delete', () => {
  const row = (over = {}) => ({
    id: ATT_ID, filename: 'stored.txt', originalName: 'node-3.log', mimeType: 'text/plain',
    incidentId: OWN_INC, changeId: null, problemId: null, uploadedById: 'eng1', ...over,
  });
  beforeEach(() => fs.writeFileSync(path.join(UPLOAD_DIR, 'stored.txt'), 'log contents'));

  it('downloads as an attachment, never inline', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue(row());
    const res = await request(buildApp()).get(`/api/v1/attachments/${ATT_ID}/download`);
    expect(res.status).toBe(200);
    expect(res.text).toBe('log contents');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="node-3.log"/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it("hides another org's file", async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue(row({ incidentId: OTHER_INC }));
    const res = await request(buildApp()).get(`/api/v1/attachments/${ATT_ID}/download`);
    expect(res.status).toBe(404);
  });

  it('cannot be tricked into reading outside the upload folder', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue(row({ filename: '../../../etc/passwd' }));
    const res = await request(buildApp()).get(`/api/v1/attachments/${ATT_ID}/download`);
    expect(res.status).toBe(410);
  });

  it('lets the uploader delete, and removes the file', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue(row());
    const res = await request(buildApp()).delete(`/api/v1/attachments/${ATT_ID}`);
    expect(res.status).toBe(200);
    expect(filesOnDisk()).not.toContain('stored.txt');
  });

  it("stops another engineer deleting someone else's file; an admin may", async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue(row({ uploadedById: 'someone-else' }));
    expect((await request(buildApp()).delete(`/api/v1/attachments/${ATT_ID}`)).status).toBe(403);
    mockUser = { id: 'adm', role: 'ADMIN', organizationId: 'org1' };
    expect((await request(buildApp()).delete(`/api/v1/attachments/${ATT_ID}`)).status).toBe(200);
  });
});

it('lists files for a ticket in the tenant only', async () => {
  mockPrisma.attachment.findMany.mockResolvedValue([{ id: ATT_ID }]);
  expect((await request(buildApp()).get(`/api/v1/attachments/incidents/${OWN_INC}`)).status).toBe(200);
  expect((await request(buildApp()).get(`/api/v1/attachments/incidents/${OTHER_INC}`)).status).toBe(404);
  expect(mockPrisma.attachment.findMany.mock.calls[0][0].where).toEqual({ incidentId: OWN_INC });
});
