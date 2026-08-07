// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Change Management Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { emitToAll, emitToUser } = require('../config/socket');
const { generateChangeNumber, paginate, paginationMeta, success, error } = require('../utils/helpers');
const { CHANGE_TRANSITIONS } = require('../config/constants');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');
const { getCreateOrgId } = require('../middleware/tenant');

const INCLUDE_LIST = {
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
  assignmentGroup: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
};

const INCLUDE_DETAIL = {
  ...INCLUDE_LIST,
  approvals: { include: { approver: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'desc' } },
  affectedCIs: { include: { configItem: { select: { id: true, name: true, type: true } } } },
  workNotes: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
  activities: { include: { user: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 50 },
  linkedIncidents: { include: { incident: { select: { id: true, number: true, shortDescription: true, state: true } } } },
};

// GET /api/v1/changes
async function listChanges(req, res, next) {
  try {
    const { type, state, riskLevel, category, assignedToId, assignmentGroupId, search, dateFrom, dateTo, sortBy, sortOrder } = req.query;
    const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);

    const where = {};
    Object.assign(where, req.tenantWhere);
    if (type) where.type = type;
    if (state) where.state = state;
    if (riskLevel) where.riskLevel = riskLevel;
    if (category) where.category = category;
    if (assignedToId) where.assignedToId = assignedToId;
    if (assignmentGroupId) where.assignmentGroupId = assignmentGroupId;
    if (search) {
      where.OR = [
        { shortDescription: { contains: search, mode: 'insensitive' } },
        { number: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const orderBy = sortBy ? { [sortBy]: sortOrder || 'desc' } : { createdAt: 'desc' };

    const [changes, total] = await prisma.$transaction([
      prisma.change.findMany({ where, include: INCLUDE_LIST, orderBy, skip, take }),
      prisma.change.count({ where }),
    ]);

    return success(res, changes, 200, paginationMeta(total, page, limit));
  } catch (err) { next(err); }
}

// GET /api/v1/changes/:id
async function getChange(req, res, next) {
  try {
    const change = await prisma.change.findUnique({ where: { id: req.params.id }, include: INCLUDE_DETAIL });
    if (!change) return error(res, 'Change not found', 404);
    if (req.tenantWhere.organizationId && change.organizationId !== req.tenantWhere.organizationId) return error(res, 'Change not found', 404);
    return success(res, change);
  } catch (err) { next(err); }
}

// POST /api/v1/changes
async function createChange(req, res, next) {
  try {
    const { shortDescription, description, type, riskLevel, category, justification, implementationPlan, rollbackPlan, testPlan, communicationPlan, assignmentGroupId, assignedToId, plannedStartDate, plannedEndDate, affectedServices, downtime, userImpact, gitRepoUrl, gitBranch } = req.body;

    const number = await generateChangeNumber();
    const changeType = type || 'NORMAL';
    const initialState = changeType === 'EMERGENCY' ? 'IMPLEMENTING' : 'NEW';

    const change = await prisma.change.create({
      data: {
        number, shortDescription, description, type: changeType,
        state: initialState, riskLevel: riskLevel || 'MEDIUM', category,
        justification, implementationPlan, rollbackPlan, testPlan, communicationPlan,
        assignmentGroupId, assignedToId, createdById: req.user.id,
        organizationId: getCreateOrgId(req),
        plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        affectedServices, downtime, userImpact, gitRepoUrl, gitBranch,
        actualStartDate: changeType === 'EMERGENCY' ? new Date() : null,
      },
      include: INCLUDE_LIST,
    });

    await prisma.activity.create({
      data: { action: 'CREATED', description: `Change ${number} created (${changeType})`, userId: req.user.id, changeId: change.id },
    });

    emitToAll('change:created', { id: change.id, number, type: changeType, shortDescription });
    logger.info(`Change created: ${number} (${changeType}) by ${req.user.email}`);
    return success(res, change, 201);
  } catch (err) { next(err); }
}

// PATCH /api/v1/changes/:id
async function updateChange(req, res, next) {
  try {
    const existing = await prisma.change.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Change not found', 404);
    if (req.tenantWhere.organizationId && existing.organizationId !== req.tenantWhere.organizationId) return error(res, 'Change not found', 404);

    if (req.body.state && req.body.state !== existing.state) {
      const allowed = CHANGE_TRANSITIONS[existing.state] || [];
      if (!allowed.includes(req.body.state)) {
        return error(res, `Cannot transition from ${existing.state} to ${req.body.state}`, 400);
      }
    }

    const data = { ...req.body };
    if (data.state === 'IMPLEMENTING') data.actualStartDate = new Date();
    if (data.state === 'CLOSED') data.actualEndDate = new Date();

    const change = await prisma.change.update({ where: { id: req.params.id }, data, include: INCLUDE_LIST });

    if (req.body.state && req.body.state !== existing.state) {
      await prisma.activity.create({
        data: { action: 'STATE_CHANGED', description: `State: ${existing.state} → ${req.body.state}`, oldValue: existing.state, newValue: req.body.state, userId: req.user.id, changeId: change.id },
      });
    }

    emitToAll('change:updated', { id: change.id, number: change.number, state: change.state });
    return success(res, change);
  } catch (err) { next(err); }
}

// POST /api/v1/changes/:id/approve
async function approveChange(req, res, next) {
  try {
    const approval = await prisma.approval.findFirst({
      where: { changeId: req.params.id, approverId: req.user.id, state: 'PENDING' },
    });
    if (!approval) return error(res, 'No pending approval found for you', 404);

    await prisma.approval.update({
      where: { id: approval.id },
      data: { state: 'APPROVED', comments: req.body.comments, approvedAt: new Date() },
    });

    // Check if all approved
    const pending = await prisma.approval.count({ where: { changeId: req.params.id, state: 'PENDING' } });
    if (pending === 0) {
      await prisma.change.update({ where: { id: req.params.id }, data: { state: 'SCHEDULED' } });
      await prisma.activity.create({
        data: { action: 'ALL_APPROVED', description: 'All approvals received — scheduled', userId: req.user.id, changeId: req.params.id },
      });
    }

    return success(res, { message: 'Change approved' });
  } catch (err) { next(err); }
}

// POST /api/v1/changes/:id/reject
async function rejectChange(req, res, next) {
  try {
    const approval = await prisma.approval.findFirst({
      where: { changeId: req.params.id, approverId: req.user.id, state: 'PENDING' },
    });
    if (!approval) return error(res, 'No pending approval found for you', 404);

    await prisma.approval.update({
      where: { id: approval.id },
      data: { state: 'REJECTED', comments: req.body.comments, approvedAt: new Date() },
    });

    await prisma.change.update({ where: { id: req.params.id }, data: { state: 'CANCELLED' } });
    await prisma.activity.create({
      data: { action: 'REJECTED', description: `Rejected by ${req.user.firstName}`, userId: req.user.id, changeId: req.params.id },
    });

    return success(res, { message: 'Change rejected' });
  } catch (err) { next(err); }
}

// POST /api/v1/changes/:id/submit
async function submitForApproval(req, res, next) {
  try {
    const change = await prisma.change.findUnique({ where: { id: req.params.id }, include: { assignmentGroup: { include: { members: { where: { role: 'LEAD' }, include: { user: true } } } } } });
    if (!change) return error(res, 'Change not found', 404);

    const approvers = change.assignmentGroup?.members || [];
    if (approvers.length === 0) return error(res, 'No approvers found in assignment group', 400);

    for (const member of approvers) {
      await prisma.approval.create({
        data: { changeId: change.id, approverId: member.userId },
      });
      emitToUser(member.userId, 'change:approval-requested', { changeId: change.id, number: change.number });
      if (member.user?.email) {
        const subject = `Approval Required: ${change.number} — ${change.shortDescription}`;
        const html = emailService.templates.changeApprovalRequest(change, member.user);
        emailService.sendEmail(member.user.email, subject, html);
      }
    }

    await prisma.change.update({ where: { id: change.id }, data: { state: 'APPROVAL' } });
    return success(res, { message: `Submitted for approval to ${approvers.length} approver(s)` });
  } catch (err) { next(err); }
}

module.exports = { listChanges, getChange, createChange, updateChange, approveChange, rejectChange, submitForApproval };
