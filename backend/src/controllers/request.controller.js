// ═══════════════════════════════════════════════════════════
// Argus ITSM — Service Catalog & Service Request Controller (agents)
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error, paginate, paginationMeta } = require('../utils/helpers');
const { getCreateOrgId, scopedWhere } = require('../middleware/tenant');
const svc = require('../services/serviceRequestService');
const logger = require('../utils/logger');

const USER_BRIEF = { select: { id: true, firstName: true, lastName: true, email: true } };
const TEAM_BRIEF = { select: { id: true, name: true } };

function fail(res, err, fallback) {
  if (err instanceof svc.RequestError) return error(res, err.message, err.status);
  logger.error(fallback, err);
  return error(res, fallback, 500);
}

async function teamInOrg(teamId, organizationId) {
  if (!teamId) return true;
  const t = await prisma.team.findFirst({ where: { id: teamId, organizationId }, select: { id: true } });
  return !!t;
}

function catalogData(body) {
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim().slice(0, 120);
  if (body.description !== undefined) data.description = body.description ? String(body.description).slice(0, 2000) : null;
  if (body.category !== undefined) data.category = body.category ? String(body.category).slice(0, 60) : null;
  if (body.formSchema !== undefined) data.formSchema = body.formSchema;
  if (body.requiresApproval !== undefined) data.requiresApproval = !!body.requiresApproval;
  if (body.approverTeamId !== undefined) data.approverTeamId = body.approverTeamId || null;
  if (body.fulfillmentTeamId !== undefined) data.fulfillmentTeamId = body.fulfillmentTeamId || null;
  if (body.fulfillmentHours !== undefined) {
    data.fulfillmentHours = body.fulfillmentHours === null || body.fulfillmentHours === '' ? null : Number(body.fulfillmentHours);
  }
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  return data;
}

async function checkCatalogData(data, organizationId) {
  if (data.name !== undefined && !data.name) return 'Name is required';
  if (data.formSchema !== undefined) {
    const e = svc.validateFormSchema(data.formSchema);
    if (e) return e;
  }
  if (data.fulfillmentHours !== undefined && data.fulfillmentHours !== null
    && (!Number.isInteger(data.fulfillmentHours) || data.fulfillmentHours < 1 || data.fulfillmentHours > 24 * 90)) {
    return 'Fulfilment target must be a whole number of hours between 1 and 2160';
  }
  if (!(await teamInOrg(data.approverTeamId, organizationId))) return 'Approver team does not belong to this organization';
  if (!(await teamInOrg(data.fulfillmentTeamId, organizationId))) return 'Fulfilment team does not belong to this organization';
  return null;
}

// ── Catalog ──────────────────────────────────────────────

async function listCatalog(req, res) {
  try {
    const where = { ...scopedWhere(req) };
    if (req.query.active === 'true') where.isActive = true;
    const items = await prisma.serviceCatalogItem.findMany({
      where,
      include: { approverTeam: TEAM_BRIEF, fulfillmentTeam: TEAM_BRIEF, _count: { select: { requests: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return success(res, items);
  } catch (err) { return fail(res, err, 'Failed to load the service catalog'); }
}

async function createCatalogItem(req, res) {
  try {
    const organizationId = getCreateOrgId(req);
    if (!organizationId) return error(res, 'Select an organization first', 400);
    const data = catalogData(req.body);
    if (!data.name) return error(res, 'Name is required', 400);
    if (data.formSchema === undefined) data.formSchema = [];
    const msg = await checkCatalogData(data, organizationId);
    if (msg) return error(res, msg, 400);
    const item = await prisma.serviceCatalogItem.create({ data: { ...data, organizationId } });
    return success(res, item, 201);
  } catch (err) { return fail(res, err, 'Failed to create the catalog item'); }
}

async function updateCatalogItem(req, res) {
  try {
    const existing = await prisma.serviceCatalogItem.findFirst({ where: { ...scopedWhere(req), id: req.params.id } });
    if (!existing) return error(res, 'Catalog item not found', 404);
    const data = catalogData(req.body);
    const msg = await checkCatalogData(data, existing.organizationId);
    if (msg) return error(res, msg, 400);
    const item = await prisma.serviceCatalogItem.update({ where: { id: existing.id }, data });
    return success(res, item);
  } catch (err) { return fail(res, err, 'Failed to update the catalog item'); }
}

// ── Requests ─────────────────────────────────────────────

const REQUEST_INCLUDE = {
  catalogItem: { select: { id: true, name: true, category: true, formSchema: true } },
  requestedBy: USER_BRIEF,
  assignedTo: USER_BRIEF,
  fulfillmentTeam: TEAM_BRIEF,
};

async function listRequests(req, res) {
  try {
    const { page, limit, state, mine, approvals, search } = req.query;
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const where = { ...scopedWhere(req) };
    if (state) where.state = { in: String(state).split(',') };
    if (mine === 'true') where.assignedToId = req.user.id;
    if (approvals === 'true') where.approvals = { some: { approverId: req.user.id, state: 'PENDING' } };
    if (search) {
      where.OR = [
        { number: { contains: String(search), mode: 'insensitive' } },
        { title: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await prisma.$transaction([
      prisma.serviceRequest.findMany({ where, include: REQUEST_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.serviceRequest.count({ where }),
    ]);
    return success(res, rows, 200, paginationMeta(total, p, l));
  } catch (err) { return fail(res, err, 'Failed to load requests'); }
}

async function getRequest(req, res) {
  try {
    const request = await prisma.serviceRequest.findFirst({
      where: { ...scopedWhere(req), id: req.params.id },
      include: {
        ...REQUEST_INCLUDE,
        approvals: { include: { approver: USER_BRIEF }, orderBy: { createdAt: 'asc' } },
        comments: { include: { author: USER_BRIEF }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!request) return error(res, 'Request not found', 404);
    return success(res, request);
  } catch (err) { return fail(res, err, 'Failed to load the request'); }
}

async function loadScoped(req) {
  return prisma.serviceRequest.findFirst({ where: { ...scopedWhere(req), id: req.params.id } });
}

// PATCH: state change, assignment, resolution notes
async function updateRequest(req, res) {
  try {
    const request = await loadScoped(req);
    if (!request) return error(res, 'Request not found', 404);
    const { state, assignedToId, fulfillmentTeamId, resolutionNotes } = req.body;

    const data = {};
    if (assignedToId !== undefined) {
      if (assignedToId) {
        const u = await prisma.user.findFirst({ where: { id: assignedToId, organizationId: request.organizationId, role: { not: 'REQUESTER' } }, select: { id: true } });
        if (!u) return error(res, 'Assignee must be an agent in this organization', 400);
      }
      data.assignedToId = assignedToId || null;
    }
    if (fulfillmentTeamId !== undefined) {
      if (!(await teamInOrg(fulfillmentTeamId, request.organizationId))) return error(res, 'Team does not belong to this organization', 400);
      data.fulfillmentTeamId = fulfillmentTeamId || null;
    }
    if (Object.keys(data).length) await prisma.serviceRequest.update({ where: { id: request.id }, data });

    if (state && state !== request.state) {
      await svc.transition({ request: { ...request, ...data }, to: state, actor: req.user, resolutionNotes });
    } else if (resolutionNotes !== undefined) {
      await prisma.serviceRequest.update({ where: { id: request.id }, data: { resolutionNotes: resolutionNotes || null } });
    }
    req.params.id = request.id;
    return getRequest(req, res);
  } catch (err) { return fail(res, err, 'Failed to update the request'); }
}

async function decideRequest(req, res) {
  try {
    const request = await loadScoped(req);
    if (!request) return error(res, 'Request not found', 404);
    const { decision, comments } = req.body;
    if (!['approve', 'reject'].includes(decision)) return error(res, 'decision must be "approve" or "reject"', 400);
    await svc.decide({ request, approverId: req.user.id, approve: decision === 'approve', comments });
    return getRequest(req, res);
  } catch (err) { return fail(res, err, 'Failed to record the decision'); }
}

async function addRequestComment(req, res) {
  try {
    const request = await loadScoped(req);
    if (!request) return error(res, 'Request not found', 404);
    const body = String(req.body.body || '').trim();
    if (!body) return error(res, 'Comment cannot be empty', 400);
    const comment = await prisma.requestComment.create({
      data: { requestId: request.id, authorId: req.user.id, body: body.slice(0, 5000), isInternal: !!req.body.isInternal },
      include: { author: USER_BRIEF },
    });
    return success(res, comment, 201);
  } catch (err) { return fail(res, err, 'Failed to add the comment'); }
}

module.exports = {
  listCatalog, createCatalogItem, updateCatalogItem,
  listRequests, getRequest, updateRequest, decideRequest, addRequestComment,
};
