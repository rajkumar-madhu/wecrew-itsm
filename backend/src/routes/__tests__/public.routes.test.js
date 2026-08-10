// ═══════════════════════════════════════════════════════════
// public.routes — wiring and rate limiting
//
// The controller tests cover validation in isolation; these drive the router
// through express so the mount path, the body parser and the rate limiter are
// exercised together. The limiter is the only thing standing between an open
// endpoint and a flood, so it is worth an actual request-level test.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const request = require('supertest');

const mockCreate = jest.fn();

jest.mock('../../config/database', () => ({
  prisma: { lead: { create: (...args) => mockCreate(...args) } },
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const VALID = {
  name: 'Asha Menon',
  email: 'asha@example.com',
  company: 'Example Ltd',
  interest: 'pilot',
};

/**
 * Fresh app per test — express-rate-limit keeps counters in module state, so
 * re-requiring the router gives each test its own budget.
 */
function buildApp() {
  jest.resetModules();
  const publicRoutes = require('../public.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/v1/public', publicRoutes);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'lead-1' });
});

describe('POST /api/v1/public/leads', () => {
  it('is reachable with no auth header at all', async () => {
    const res = await request(buildApp()).post('/api/v1/public/leads').send(VALID);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: { id: 'lead-1' } });
  });

  it('returns 400 with a usable message on invalid input', async () => {
    const res = await request(buildApp())
      .post('/api/v1/public/leads')
      .send({ ...VALID, email: 'nope' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/incomplete/i);
  });

  it('does not expose GET on the collection', async () => {
    // Leads are not readable by anyone anonymous; only POST is mounted.
    const res = await request(buildApp()).get('/api/v1/public/leads');
    expect(res.status).toBe(404);
  });
});

describe('rate limiting', () => {
  it('allows 5 submissions from one address then blocks the 6th', async () => {
    const app = buildApp();
    const send = () =>
      request(app)
        .post('/api/v1/public/leads')
        .set('X-Forwarded-For', '203.0.113.9')
        .send(VALID);

    for (let i = 0; i < 5; i++) {
      expect((await send()).status).toBe(201);
    }

    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/email us instead/i);
    // The 6th never reached the database.
    expect(mockCreate).toHaveBeenCalledTimes(5);
  });

  it('buckets per forwarded client address, not per proxy hop', async () => {
    const app = buildApp();
    const from = (ip) =>
      request(app).post('/api/v1/public/leads').set('X-Forwarded-For', ip).send(VALID);

    // Exhaust one visitor's budget.
    for (let i = 0; i < 5; i++) await from('203.0.113.10');
    expect((await from('203.0.113.10')).status).toBe(429);

    // A different visitor behind the same proxy is unaffected — the bug this
    // guards is keying on req.ip, which would collapse everyone into one bucket.
    expect((await from('198.51.100.4')).status).toBe(201);
  });
});
