jest.mock('../../config/database', () => ({ prisma: {} }));
const { requesterMayUse } = require('../auth');

const req = (url) => ({ originalUrl: url });

it.each([
  '/api/v1/portal/catalog',
  '/api/v1/portal/requests/123?x=1',
  '/api/v1/notifications',
  '/api/v1/auth/me',
  '/api/v1/auth/logout',
  '/api/v1/auth/mfa/setup',
])('lets a requester use %s', (url) => expect(requesterMayUse(req(url))).toBe(true));

it.each([
  '/api/v1/incidents',
  '/api/v1/requests',
  '/api/v1/assets/1',
  '/api/v1/auth/users',
  '/api/v1/auth/register',
  '/api/v1/knowledge',
  '/api/v1/portalx',
  '/api/v1/dashboard/stats',
])('keeps a requester out of %s', (url) => expect(requesterMayUse(req(url))).toBe(false));
