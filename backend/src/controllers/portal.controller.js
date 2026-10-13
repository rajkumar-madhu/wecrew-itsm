// ═══════════════════════════════════════════════════════════
// Argus ITSM — Self-service Portal Controller
// Everything here is scoped to the signed-in person: their own requests and
// incidents, their organization's catalog and portal-visible articles.
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error, generateIncidentNumber } = require('../utils/helpers');
const { calculateSLATargetTimesForOrg } = require('../services/slaPolicyService');
const svc = require('../services/serviceRequestService');
const { recordFeedback } = require('./knowledge.controller');
const { emitToAll } = require('../config/socket');
const logger = require('../utils/logger');

const AGENT_BRIEF = { select: { id: true, firstName: true, lastName: true } };
const URGENCY_FOR = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH' };

function fail(res, err, fallback) {
  if (err instanceof svc.RequestError) return error(res, err.message, err.status);
  logger.error(fallback, err);
  return error(res, fallback, 500);
}

function orgOf(req) {
  return req.user.organizationId || null;
}

// ── Catalog ──────────────────────────────────────────────

async function listCatalog(req, res) {
  try {
    const organizationId = orgOf(req);
    if (!organizationId) return success(res, []);
    const items = await prisma.serviceCatalogItem.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, description: true, category: true, formSchema: true, requiresApproval: true, fulfillmentHours: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return success(res, items);
  } catch (err) { return fail(res, err, 'Failed to load the catalog'); }
}

// ── My requests ──────────────────────────────────────────

async function createRequest(req, res) {
  try {
    const { catalogItemId, title, description, formData } = req.body;
    if (!catalogItemId) return error(res, 'Choose what you need from the catalog', 400);
    const request = await svc.createRequest({
      requester: req.user, organizationId: orgOf(req), catalogItemId, title, description, formData,
    });
    return success(res, request, 201);
  } catch (err) { return fail(res, err, 'Failed to submit the request'); }
}

async function listMyRequests(req, res) {
  try {
    const rows = await prisma.serviceRequest.findMany({
      where: { requestedById: req.user.id },
      select: {
        id: true, number: true, title: true, state: true, createdAt: true, updatedAt: true, dueAt: true, csatScore: true,
        catalogItem: { select: { name: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return success(res, rows);
  } catch (err) { return fail(res, err, 'Failed to load your requests'); }
}

async function getMyRequest(req, res) {
  try {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: req.params.id, requestedById: req.user.id },
      include: {
        catalogItem: { select: { name: true, category: true, formSchema: true } },
        assignedTo: AGENT_BRIEF,
        approvals: { select: { state: true, decidedAt: true } },
        comments: { where: { isInternal: false }, include: { author: AGENT_BRIEF }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!request) return error(res, 'Request not found', 404);
    return success(res, request);
  } catch (err) { return fail(res, err, 'Failed to load the request'); }
}

async function commentOnRequest(req, res) {
  try {
    const request = await prisma.serviceRequest.findFirst({ where: { id: req.params.id, requestedById: req.user.id }, select: { id: true } });
    if (!request) return error(res, 'Request not found', 404);
    const body = String(req.body.body || '').trim();
    if (!body) return error(res, 'Comment cannot be empty', 400);
    const comment = await prisma.requestComment.create({
      data: { requestId: request.id, authorId: req.user.id, body: body.slice(0, 5000) },
      include: { author: AGENT_BRIEF },
    });
    return success(res, comment, 201);
  } catch (err) { return fail(res, err, 'Failed to add the comment'); }
}

async function cancelRequest(req, res) {
  try {
    const request = await prisma.serviceRequest.findFirst({ where: { id: req.params.id, requestedById: req.user.id } });
    if (!request) return error(res, 'Request not found', 404);
    if (!['SUBMITTED', 'PENDING_APPROVAL'].includes(request.state)) {
      return error(res, 'Only a request that has not started can be cancelled', 409);
    }
    const updated = await svc.transition({ request, to: 'CANCELLED', actor: req.user, resolutionNotes: 'Cancelled by requester' });
    return success(res, updated);
  } catch (err) { return fail(res, err, 'Failed to cancel the request'); }
}

async function rateRequest(req, res) {
  try {
    const request = await prisma.serviceRequest.findFirst({ where: { id: req.params.id, requestedById: req.user.id } });
    if (!request) return error(res, 'Request not found', 404);
    if (request.state !== 'FULFILLED') return error(res, 'You can rate a request once it is fulfilled', 409);
    if (request.csatScore) return error(res, 'You have already rated this request', 409);
    const data = svc.validateCsat(req.body.score, req.body.comment);
    const updated = await prisma.serviceRequest.update({ where: { id: request.id }, data });
    return success(res, { id: updated.id, csatScore: updated.csatScore });
  } catch (err) { return fail(res, err, 'Failed to save your rating'); }
}

// ── My incidents ─────────────────────────────────────────

async function reportIncident(req, res) {
  try {
    const organizationId = orgOf(req);
    if (!organizationId) return error(res, 'Your account is not linked to an organization', 400);
    const shortDescription = String(req.body.shortDescription || '').trim();
    if (shortDescription.length < 5) return error(res, 'Describe the problem in at least 5 characters', 400);
    const urgency = URGENCY_FOR[String(req.body.urgency || 'medium').toLowerCase()];
    if (!urgency) return error(res, 'Urgency must be low, medium or high', 400);

    // Requesters can't judge business impact; agents re-triage after intake
    const impact = 'INDIVIDUAL';
    const priority = urgency === 'HIGH' ? 'P3' : 'P4';
    const sla = await calculateSLATargetTimesForOrg(priority, new Date(), organizationId);
    const incident = await prisma.incident.create({
      data: {
        number: await generateIncidentNumber(),
        shortDescription: shortDescription.slice(0, 200),
        description: req.body.description ? String(req.body.description).slice(0, 10000) : null,
        impact, urgency, priority,
        category: req.body.category ? String(req.body.category).slice(0, 60) : null,
        source: 'PORTAL',
        createdById: req.user.id,
        organizationId,
        ...sla,
      },
      select: { id: true, number: true, shortDescription: true, state: true, priority: true, createdAt: true },
    });
    emitToAll('incident:created', { id: incident.id, number: incident.number, priority: incident.priority });
    return success(res, incident, 201);
  } catch (err) { return fail(res, err, 'Failed to report the issue'); }
}

async function listMyIncidents(req, res) {
  try {
    const rows = await prisma.incident.findMany({
      where: { createdById: req.user.id },
      select: { id: true, number: true, shortDescription: true, state: true, priority: true, createdAt: true, updatedAt: true, resolvedAt: true, csatScore: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return success(res, rows);
  } catch (err) { return fail(res, err, 'Failed to load your incidents'); }
}

async function getMyIncident(req, res) {
  try {
    const incident = await prisma.incident.findFirst({
      where: { id: req.params.id, createdById: req.user.id },
      select: {
        id: true, number: true, shortDescription: true, description: true, state: true, priority: true,
        createdAt: true, updatedAt: true, resolvedAt: true, resolutionNotes: true, csatScore: true, csatComment: true,
        assignedTo: AGENT_BRIEF,
        workNotes: {
          where: { isInternal: false, source: 'MANUAL' },
          select: { id: true, content: true, createdAt: true, author: AGENT_BRIEF },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!incident) return error(res, 'Incident not found', 404);
    return success(res, incident);
  } catch (err) { return fail(res, err, 'Failed to load the incident'); }
}

async function commentOnIncident(req, res) {
  try {
    const incident = await prisma.incident.findFirst({ where: { id: req.params.id, createdById: req.user.id }, select: { id: true } });
    if (!incident) return error(res, 'Incident not found', 404);
    const content = String(req.body.body || '').trim();
    if (!content) return error(res, 'Comment cannot be empty', 400);
    const note = await prisma.workNote.create({
      data: { incidentId: incident.id, authorId: req.user.id, content: content.slice(0, 5000), isInternal: false },
      select: { id: true, content: true, createdAt: true, author: AGENT_BRIEF },
    });
    return success(res, note, 201);
  } catch (err) { return fail(res, err, 'Failed to add the comment'); }
}

async function rateIncident(req, res) {
  try {
    const incident = await prisma.incident.findFirst({ where: { id: req.params.id, createdById: req.user.id } });
    if (!incident) return error(res, 'Incident not found', 404);
    if (!['RESOLVED', 'CLOSED'].includes(incident.state)) return error(res, 'You can rate an incident once it is resolved', 409);
    if (incident.csatScore) return error(res, 'You have already rated this incident', 409);
    const data = svc.validateCsat(req.body.score, req.body.comment);
    const updated = await prisma.incident.update({ where: { id: incident.id }, data });
    return success(res, { id: updated.id, csatScore: updated.csatScore });
  } catch (err) { return fail(res, err, 'Failed to save your rating'); }
}

// ── Knowledge ────────────────────────────────────────────

function portalArticleWhere(req) {
  return { organizationId: orgOf(req) || '__none__', state: 'PUBLISHED', audience: 'PORTAL' };
}

async function searchArticles(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    const where = portalArticleWhere(req);
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
        { tags: { has: q.toLowerCase() } },
      ];
    }
    const rows = await prisma.knowledgeArticle.findMany({
      where,
      select: { id: true, number: true, title: true, category: true, tags: true, updatedAt: true, helpfulYes: true },
      orderBy: q ? { helpfulYes: 'desc' } : { updatedAt: 'desc' },
      take: 30,
    });
    return success(res, rows);
  } catch (err) { return fail(res, err, 'Failed to search articles'); }
}

async function getArticle(req, res) {
  try {
    const article = await prisma.knowledgeArticle.findFirst({
      where: { ...portalArticleWhere(req), id: req.params.id },
      select: { id: true, number: true, title: true, body: true, category: true, tags: true, publishedAt: true, updatedAt: true, helpfulYes: true, helpfulNo: true },
    });
    if (!article) return error(res, 'Article not found', 404);
    await prisma.knowledgeArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });
    const mine = await prisma.articleFeedback.findUnique({ where: { articleId_userId: { articleId: article.id, userId: req.user.id } }, select: { helpful: true } });
    return success(res, { ...article, myFeedback: mine ? mine.helpful : null });
  } catch (err) { return fail(res, err, 'Failed to load the article'); }
}

async function articleFeedback(req, res) {
  try {
    const article = await prisma.knowledgeArticle.findFirst({ where: { ...portalArticleWhere(req), id: req.params.id }, select: { id: true } });
    if (!article) return error(res, 'Article not found', 404);
    const counts = await recordFeedback(article.id, req.user.id, req.body.helpful);
    return success(res, counts);
  } catch (err) { return fail(res, err, 'Failed to save your feedback'); }
}

module.exports = {
  listCatalog, createRequest, listMyRequests, getMyRequest, commentOnRequest, cancelRequest, rateRequest,
  reportIncident, listMyIncidents, getMyIncident, commentOnIncident, rateIncident,
  searchArticles, getArticle, articleFeedback,
};
