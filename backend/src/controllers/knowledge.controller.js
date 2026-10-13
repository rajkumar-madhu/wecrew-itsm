// ═══════════════════════════════════════════════════════════
// Argus ITSM — Knowledge Article Controller (agents)
// Draft → In review → Published → Retired. Publishing and retiring are for
// admins and managers; anyone else's edit to a published article sends it
// back to review.
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error, paginate, paginationMeta, generateArticleNumber } = require('../utils/helpers');
const { getCreateOrgId, scopedWhere } = require('../middleware/tenant');
const logger = require('../utils/logger');

const AUTHOR = { select: { id: true, firstName: true, lastName: true } };
const STATES = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'RETIRED'];
const AUDIENCES = ['INTERNAL', 'PORTAL'];

const isReviewer = (user) => ['ADMIN', 'MANAGER'].includes(user.role);

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 15).map((t) => t.slice(0, 40));
}

function articleData(body) {
  const data = {};
  if (body.title !== undefined) data.title = String(body.title).trim().slice(0, 200);
  if (body.body !== undefined) data.body = String(body.body).slice(0, 100000);
  if (body.category !== undefined) data.category = body.category ? String(body.category).slice(0, 60) : null;
  if (body.tags !== undefined) data.tags = cleanTags(body.tags);
  if (body.audience !== undefined) data.audience = body.audience;
  return data;
}

function checkData(data) {
  if (data.title !== undefined && data.title.length < 3) return 'Title must be at least 3 characters';
  if (data.body !== undefined && !data.body.trim()) return 'Article body cannot be empty';
  if (data.audience !== undefined && !AUDIENCES.includes(data.audience)) return 'Audience must be INTERNAL or PORTAL';
  return null;
}

async function listArticles(req, res) {
  try {
    const { page, limit, state, q, audience } = req.query;
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const where = { ...scopedWhere(req) };
    const states = String(state || '').split(',').filter((s) => STATES.includes(s));
    if (states.length) where.state = { in: states };
    if (AUDIENCES.includes(audience)) where.audience = audience;
    if (q) {
      where.OR = [
        { title: { contains: String(q), mode: 'insensitive' } },
        { body: { contains: String(q), mode: 'insensitive' } },
        { number: { contains: String(q), mode: 'insensitive' } },
        { tags: { has: String(q).toLowerCase() } },
      ];
    }
    const [rows, total] = await prisma.$transaction([
      prisma.knowledgeArticle.findMany({
        where,
        select: {
          id: true, number: true, title: true, category: true, tags: true, state: true, audience: true, version: true,
          helpfulYes: true, helpfulNo: true, viewCount: true, updatedAt: true, publishedAt: true, author: AUTHOR,
        },
        orderBy: { updatedAt: 'desc' }, skip, take,
      }),
      prisma.knowledgeArticle.count({ where }),
    ]);
    return success(res, rows, 200, paginationMeta(total, p, l));
  } catch (err) {
    logger.error('listArticles failed:', err);
    return error(res, 'Failed to load articles', 500);
  }
}

async function getArticle(req, res) {
  try {
    const article = await prisma.knowledgeArticle.findFirst({ where: { ...scopedWhere(req), id: req.params.id }, include: { author: AUTHOR } });
    if (!article) return error(res, 'Article not found', 404);
    const mine = await prisma.articleFeedback.findUnique({ where: { articleId_userId: { articleId: article.id, userId: req.user.id } }, select: { helpful: true } });
    return success(res, { ...article, myFeedback: mine ? mine.helpful : null });
  } catch (err) {
    logger.error('getArticle failed:', err);
    return error(res, 'Failed to load the article', 500);
  }
}

async function createArticle(req, res) {
  try {
    const organizationId = getCreateOrgId(req);
    if (!organizationId) return error(res, 'Select an organization first', 400);
    const data = articleData(req.body);
    if (!data.title || !data.body) return error(res, 'Title and body are required', 400);
    const msg = checkData(data);
    if (msg) return error(res, msg, 400);

    let sourceIncidentId = null;
    if (req.body.sourceIncidentId) {
      const inc = await prisma.incident.findFirst({ where: { ...scopedWhere(req), id: req.body.sourceIncidentId }, select: { id: true } });
      if (!inc) return error(res, 'Source incident not found', 400);
      sourceIncidentId = inc.id;
    }
    const article = await prisma.knowledgeArticle.create({
      data: { ...data, number: await generateArticleNumber(), authorId: req.user.id, organizationId, sourceIncidentId },
      include: { author: AUTHOR },
    });
    return success(res, article, 201);
  } catch (err) {
    logger.error('createArticle failed:', err);
    return error(res, 'Failed to create the article', 500);
  }
}

// POST /knowledge/from-incident/:incidentId — a draft prefilled from a resolved incident
async function draftFromIncident(req, res) {
  try {
    const inc = await prisma.incident.findFirst({
      where: { ...scopedWhere(req), id: req.params.incidentId },
      select: { id: true, number: true, shortDescription: true, description: true, resolutionNotes: true, category: true, organizationId: true, state: true },
    });
    if (!inc) return error(res, 'Incident not found', 404);
    if (!['RESOLVED', 'CLOSED'].includes(inc.state)) return error(res, 'Resolve the incident before writing it up', 409);
    const body = [
      '## Symptoms', '', inc.description || inc.shortDescription, '',
      '## Resolution', '', inc.resolutionNotes || '_Describe the fix._', '',
      `_Source: ${inc.number}_`,
    ].join('\n');
    const article = await prisma.knowledgeArticle.create({
      data: {
        number: await generateArticleNumber(), title: inc.shortDescription.slice(0, 200), body,
        category: inc.category, authorId: req.user.id, organizationId: inc.organizationId, sourceIncidentId: inc.id,
      },
      include: { author: AUTHOR },
    });
    return success(res, article, 201);
  } catch (err) {
    logger.error('draftFromIncident failed:', err);
    return error(res, 'Failed to draft the article', 500);
  }
}

async function updateArticle(req, res) {
  try {
    const existing = await prisma.knowledgeArticle.findFirst({ where: { ...scopedWhere(req), id: req.params.id } });
    if (!existing) return error(res, 'Article not found', 404);
    if (existing.authorId !== req.user.id && !isReviewer(req.user)) return error(res, 'Only the author or a manager can edit this article', 403);
    if (existing.state === 'RETIRED') return error(res, 'Retired articles cannot be edited', 409);
    const data = articleData(req.body);
    const msg = checkData(data);
    if (msg) return error(res, msg, 400);
    if (existing.state === 'PUBLISHED') {
      data.version = existing.version + 1;
      if (!isReviewer(req.user)) data.state = 'IN_REVIEW'; // a non-reviewer's change needs review again
    }
    const article = await prisma.knowledgeArticle.update({ where: { id: existing.id }, data, include: { author: AUTHOR } });
    return success(res, article);
  } catch (err) {
    logger.error('updateArticle failed:', err);
    return error(res, 'Failed to update the article', 500);
  }
}

const WORKFLOW = {
  submit:  { from: ['DRAFT'], to: 'IN_REVIEW', reviewer: false },
  publish: { from: ['DRAFT', 'IN_REVIEW'], to: 'PUBLISHED', reviewer: true },
  reject:  { from: ['IN_REVIEW'], to: 'DRAFT', reviewer: true },
  retire:  { from: ['PUBLISHED'], to: 'RETIRED', reviewer: true },
  restore: { from: ['RETIRED'], to: 'DRAFT', reviewer: true },
};

// POST /knowledge/:id/:action
async function moveArticle(req, res) {
  try {
    const step = WORKFLOW[req.params.action];
    if (!step) return error(res, 'Unknown action', 404);
    const existing = await prisma.knowledgeArticle.findFirst({ where: { ...scopedWhere(req), id: req.params.id } });
    if (!existing) return error(res, 'Article not found', 404);
    if (step.reviewer && !isReviewer(req.user)) return error(res, 'Only admins and managers can do this', 403);
    if (!step.reviewer && existing.authorId !== req.user.id && !isReviewer(req.user)) return error(res, 'Only the author can submit this article', 403);
    if (!step.from.includes(existing.state)) return error(res, `Cannot ${req.params.action} a ${existing.state.toLowerCase().replace('_', ' ')} article`, 409);
    const data = { state: step.to };
    if (step.to === 'PUBLISHED') { data.publishedAt = new Date(); data.reviewedById = req.user.id; }
    const article = await prisma.knowledgeArticle.update({ where: { id: existing.id }, data, include: { author: AUTHOR } });
    return success(res, article);
  } catch (err) {
    logger.error('moveArticle failed:', err);
    return error(res, 'Failed to update the article', 500);
  }
}

// One vote per person; changing a vote moves the count
async function recordFeedback(articleId, userId, helpfulInput) {
  const helpful = helpfulInput === true || helpfulInput === 'true';
  return prisma.$transaction(async (tx) => {
    const prev = await tx.articleFeedback.findUnique({ where: { articleId_userId: { articleId, userId } } });
    if (prev && prev.helpful === helpful) {
      return tx.knowledgeArticle.findUnique({ where: { id: articleId }, select: { helpfulYes: true, helpfulNo: true } });
    }
    const inc = {};
    if (prev) inc[prev.helpful ? 'helpfulYes' : 'helpfulNo'] = { decrement: 1 };
    inc[helpful ? 'helpfulYes' : 'helpfulNo'] = { increment: 1 };
    await tx.articleFeedback.upsert({
      where: { articleId_userId: { articleId, userId } },
      create: { articleId, userId, helpful },
      update: { helpful },
    });
    return tx.knowledgeArticle.update({ where: { id: articleId }, data: inc, select: { helpfulYes: true, helpfulNo: true } });
  });
}

async function feedback(req, res) {
  try {
    const article = await prisma.knowledgeArticle.findFirst({ where: { ...scopedWhere(req), id: req.params.id, state: 'PUBLISHED' }, select: { id: true } });
    if (!article) return error(res, 'Article not found', 404);
    return success(res, await recordFeedback(article.id, req.user.id, req.body.helpful));
  } catch (err) {
    logger.error('article feedback failed:', err);
    return error(res, 'Failed to save feedback', 500);
  }
}

module.exports = {
  listArticles, getArticle, createArticle, draftFromIncident, updateArticle, moveArticle, feedback, recordFeedback,
};
