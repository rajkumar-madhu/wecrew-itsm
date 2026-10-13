let article;
const mockFind = jest.fn(async () => article);
const mockUpdate = jest.fn(async ({ data }) => ({ ...article, ...data }));
jest.mock('../../config/database', () => ({
  prisma: { knowledgeArticle: { findFirst: (...a) => mockFind(...a), update: (...a) => mockUpdate(...a) } },
}));
jest.mock('../../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const { moveArticle, updateArticle } = require('../knowledge.controller');

function res() { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; }
const engineer = { id: 'u-eng', role: 'ENGINEER' };
const manager = { id: 'u-mgr', role: 'MANAGER' };
const req = (user, params, body = {}) => ({ user, params, body, tenantWhere: { organizationId: 'acme' } });

beforeEach(() => { jest.clearAllMocks(); article = { id: 'a1', authorId: 'u-eng', state: 'DRAFT', version: 1 }; });

it('lets the author submit a draft for review', async () => {
  const r = res();
  await moveArticle(req(engineer, { id: 'a1', action: 'submit' }), r);
  expect(mockUpdate.mock.calls[0][0].data.state).toBe('IN_REVIEW');
});

it('does not let an engineer publish', async () => {
  const r = res();
  await moveArticle(req(engineer, { id: 'a1', action: 'publish' }), r);
  expect(r.status).toHaveBeenCalledWith(403);
});

it('records who published and when', async () => {
  article.state = 'IN_REVIEW';
  await moveArticle(req(manager, { id: 'a1', action: 'publish' }), res());
  expect(mockUpdate.mock.calls[0][0].data).toMatchObject({ state: 'PUBLISHED', reviewedById: 'u-mgr', publishedAt: expect.any(Date) });
});

it('sends an engineer edit of a published article back to review', async () => {
  article.state = 'PUBLISHED';
  await updateArticle(req(engineer, { id: 'a1' }, { body: 'Updated steps' }), res());
  expect(mockUpdate.mock.calls[0][0].data).toMatchObject({ state: 'IN_REVIEW', version: 2 });
});

it('keeps a manager edit published', async () => {
  article.state = 'PUBLISHED';
  await updateArticle(req(manager, { id: 'a1' }, { body: 'Updated steps' }), res());
  expect(mockUpdate.mock.calls[0][0].data.state).toBeUndefined();
});
