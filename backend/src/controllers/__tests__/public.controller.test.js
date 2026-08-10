// ═══════════════════════════════════════════════════════════
// public.controller — POST /api/v1/public/leads
//
// This is the only unauthenticated write path in the API, so the cases below
// lean on the parts that matter when the caller is anonymous and hostile:
// validation, field caps, and never echoing internal detail on failure.
// ═══════════════════════════════════════════════════════════

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

const logger = require('../../utils/logger');
const { createLead } = require('../public.controller');

/** Minimal express req/res doubles — enough to assert status and body. */
function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

const mockReq = (body, headers = {}) => ({
  body,
  headers: { 'user-agent': 'jest', ...headers },
  ip: '10.0.0.1',
});

const VALID = {
  name: 'Asha Menon',
  email: 'Asha@Example.COM',
  company: 'Example Ltd',
  interest: 'pilot',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'lead-1' });
});

describe('happy path', () => {
  it('stores a valid pilot request and returns only the id', async () => {
    const res = mockRes();
    await createLead(mockReq(VALID), res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ success: true, data: { id: 'lead-1' } });
    // An anonymous caller gets back an id and nothing else.
    expect(mockCreate.mock.calls[0][0].select).toEqual({ id: true });
  });

  it('normalises the email and maps interest to the enum', async () => {
    await createLead(mockReq(VALID), mockRes());

    const { data } = mockCreate.mock.calls[0][0];
    expect(data.email).toBe('asha@example.com');
    expect(data.interest).toBe('PILOT');
  });

  it('accepts a demo request', async () => {
    await createLead(mockReq({ ...VALID, interest: 'DEMO' }), mockRes());
    expect(mockCreate.mock.calls[0][0].data.interest).toBe('DEMO');
  });

  it('stores blank optional fields as null rather than empty strings', async () => {
    await createLead(mockReq({ ...VALID, phone: '   ', teamSize: '', message: '  ' }), mockRes());

    const { data } = mockCreate.mock.calls[0][0];
    expect(data.phone).toBeNull();
    expect(data.teamSize).toBeNull();
    expect(data.message).toBeNull();
  });
});

describe('validation', () => {
  const cases = [
    ['missing name', { ...VALID, name: '' }, 'your name'],
    ['whitespace-only name', { ...VALID, name: '   ' }, 'your name'],
    ['missing email', { ...VALID, email: '' }, 'email address'],
    ['malformed email', { ...VALID, email: 'asha@example' }, 'looks incomplete'],
    ['missing company', { ...VALID, company: '' }, 'organisation'],
    ['unknown interest', { ...VALID, interest: 'partnership' }, 'Unrecognised'],
    ['missing interest', { ...VALID, interest: undefined }, 'Unrecognised'],
  ];

  it.each(cases)('rejects %s with 400 and writes nothing', async (_label, body, expected) => {
    const res = mockRes();
    await createLead(mockReq(body), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain(expected);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('survives a request with no body at all', async () => {
    const res = mockRes();
    await createLead({ headers: {}, ip: '10.0.0.1' }, res);

    expect(res.statusCode).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('ignores non-string field types instead of throwing', async () => {
    const res = mockRes();
    await createLead(mockReq({ name: { a: 1 }, email: 42, company: [], interest: 'pilot' }), res);

    expect(res.statusCode).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('untrusted input is bounded', () => {
  it('caps every field so one request cannot store megabytes', async () => {
    await createLead(
      mockReq({
        name: 'a'.repeat(5000),
        // Long but within the RFC cap — the other fields are what gets trimmed.
        email: `${'b'.repeat(200)}@example.com`,
        company: 'c'.repeat(5000),
        phone: 'd'.repeat(5000),
        teamSize: 'e'.repeat(5000),
        message: 'f'.repeat(100000),
        interest: 'pilot',
      }, { 'user-agent': 'u'.repeat(5000) }),
      mockRes()
    );

    const { data } = mockCreate.mock.calls[0][0];
    expect(data.name).toHaveLength(120);
    expect(data.company).toHaveLength(160);
    expect(data.phone).toHaveLength(40);
    expect(data.teamSize).toHaveLength(40);
    expect(data.message).toHaveLength(4000);
    expect(data.userAgent).toHaveLength(400);
    expect(data.email.length).toBeLessThanOrEqual(254);
  });

  it('rejects an over-length email honestly instead of trimming it into "incomplete"', async () => {
    const res = mockRes();
    await createLead(mockReq({ ...VALID, email: `${'b'.repeat(300)}@example.com` }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('too long');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('strips newlines from single-line fields but keeps them in the message', async () => {
    await createLead(
      mockReq({ ...VALID, name: 'Asha\r\nMenon', message: 'line one\nline two' }),
      mockRes()
    );

    const { data } = mockCreate.mock.calls[0][0];
    expect(data.name).toBe('Asha Menon');
    expect(data.message).toBe('line one\nline two');
  });

  it('records the forwarded client address, not the proxy hop', async () => {
    await createLead(
      mockReq(VALID, { 'x-forwarded-for': '203.0.113.7, 10.42.0.1' }),
      mockRes()
    );

    expect(mockCreate.mock.calls[0][0].data.sourceIp).toBe('203.0.113.7');
  });

  it('falls back to req.ip when there is no forwarded header', async () => {
    await createLead(mockReq(VALID), mockRes());
    expect(mockCreate.mock.calls[0][0].data.sourceIp).toBe('10.0.0.1');
  });
});

describe('failures stay opaque to the caller', () => {
  it('returns a generic 500 and keeps the reason in the log', async () => {
    mockCreate.mockRejectedValue(
      new Error('connect ECONNREFUSED postgres.linkedeye-core:5432')
    );

    const res = mockRes();
    await createLead(mockReq(VALID), res);

    expect(res.statusCode).toBe(500);
    // The DB host must not leak to an anonymous internet caller.
    expect(res.body.error).not.toContain('postgres');
    expect(res.body.error).not.toContain('ECONNREFUSED');
    expect(res.body.error).toContain('email us instead');
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('ECONNREFUSED'));
  });

  it('never sets a tenant or user relation on the created row', async () => {
    await createLead(mockReq({ ...VALID, organizationId: 'org-1', userId: 'user-1' }), mockRes());

    const { data } = mockCreate.mock.calls[0][0];
    expect(data.organizationId).toBeUndefined();
    expect(data.userId).toBeUndefined();
    expect(data.status).toBeUndefined(); // defaults to NEW in the schema
  });
});
