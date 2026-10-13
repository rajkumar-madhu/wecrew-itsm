// ═══════════════════════════════════════════════════════════
// Argus ITSM — Service requests
// Catalog form validation, approval routing and state changes, shared by
// the agent API (/requests) and the self-service portal (/portal).
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { generateRequestNumber } = require('../utils/helpers');
const { REQUEST_TRANSITIONS } = require('../config/constants');
const { createNotification } = require('./notificationService');
const logger = require('../utils/logger');

const FIELD_TYPES = ['text', 'textarea', 'select', 'number', 'date', 'checkbox'];
const MAX_FIELDS = 30;

class RequestError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Validate an admin-authored catalog form definition
function validateFormSchema(schema) {
  if (!Array.isArray(schema)) return 'formSchema must be a list of fields';
  if (schema.length > MAX_FIELDS) return `A form can have at most ${MAX_FIELDS} fields`;
  const keys = new Set();
  for (const [i, f] of schema.entries()) {
    if (!f || typeof f !== 'object') return `Field ${i + 1} is not an object`;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(f.key || '')) return `Field ${i + 1} needs a key of letters, digits or _ (max 40)`;
    if (keys.has(f.key)) return `Field key "${f.key}" is used twice`;
    keys.add(f.key);
    if (!f.label || typeof f.label !== 'string' || f.label.length > 120) return `Field "${f.key}" needs a label (max 120 characters)`;
    if (!FIELD_TYPES.includes(f.type)) return `Field "${f.key}" has unknown type "${f.type}"`;
    if (f.type === 'select' && (!Array.isArray(f.options) || !f.options.length || f.options.some((o) => typeof o !== 'string'))) {
      return `Select field "${f.key}" needs a list of options`;
    }
  }
  return null;
}

// Check a requester's answers against the item's form; returns cleaned data
function validateFormData(schema, data = {}) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new RequestError('formData must be an object');
  const clean = {};
  for (const f of schema || []) {
    const v = data[f.key];
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (f.required && f.type !== 'checkbox') throw new RequestError(`"${f.label}" is required`);
      continue;
    }
    switch (f.type) {
      case 'number': {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new RequestError(`"${f.label}" must be a number`);
        clean[f.key] = n;
        break;
      }
      case 'checkbox':
        clean[f.key] = v === true || v === 'true';
        break;
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(v))) throw new RequestError(`"${f.label}" must be a date (YYYY-MM-DD)`);
        clean[f.key] = String(v);
        break;
      case 'select':
        if (!f.options.includes(v)) throw new RequestError(`"${f.label}" must be one of: ${f.options.join(', ')}`);
        clean[f.key] = v;
        break;
      default: {
        const s = String(v);
        if (s.length > (f.type === 'textarea' ? 5000 : 500)) throw new RequestError(`"${f.label}" is too long`);
        clean[f.key] = s;
      }
    }
  }
  return clean;
}

// Who approves: the approver team's leads, else the org's admins and managers
async function findApprovers(item, organizationId) {
  if (item.approverTeamId) {
    const leads = await prisma.teamMember.findMany({
      where: { teamId: item.approverTeamId, role: 'LEAD', user: { status: 'ACTIVE' } },
      select: { userId: true },
    });
    if (leads.length) return leads.map((l) => l.userId);
  }
  if (!organizationId) return [];
  const managers = await prisma.user.findMany({
    where: { organizationId, status: 'ACTIVE', role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true },
  });
  return managers.map((m) => m.id);
}

function hoursFrom(date, hours) {
  return hours ? new Date(date.getTime() + hours * 3600000) : null;
}

async function createRequest({ requester, organizationId, catalogItemId, title, description, formData }) {
  if (!organizationId) throw new RequestError('Your account is not linked to an organization', 400);
  const item = await prisma.serviceCatalogItem.findFirst({ where: { id: catalogItemId, organizationId, isActive: true } });
  if (!item) throw new RequestError('That catalog item is not available', 404);

  const clean = validateFormData(item.formSchema, formData);
  const approvers = item.requiresApproval ? await findApprovers(item, organizationId) : [];
  const needsApproval = approvers.length > 0;
  if (item.requiresApproval && !needsApproval) {
    logger.warn(`Catalog item ${item.id} requires approval but has no approvers; skipping approval`);
  }
  const now = new Date();
  const number = await generateRequestNumber();

  const request = await prisma.serviceRequest.create({
    data: {
      number,
      catalogItemId: item.id,
      title: (title || item.name).slice(0, 200),
      description: description ? String(description).slice(0, 5000) : null,
      formData: clean,
      state: needsApproval ? 'PENDING_APPROVAL' : 'SUBMITTED',
      requestedById: requester.id,
      fulfillmentTeamId: item.fulfillmentTeamId,
      dueAt: needsApproval ? null : hoursFrom(now, item.fulfillmentHours),
      organizationId,
      approvals: needsApproval ? { create: approvers.map((approverId) => ({ approverId })) } : undefined,
    },
  });

  for (const approverId of approvers) {
    createNotification(approverId, 'SYSTEM', `Approval needed: ${number}`,
      `${requester.firstName} ${requester.lastName} requested "${item.name}"`, `/requests/${request.id}`);
  }
  return request;
}

// An approver decides; the first rejection or first approval settles it
async function decide({ request, approverId, approve, comments }) {
  if (request.state !== 'PENDING_APPROVAL') throw new RequestError('This request is not waiting for approval', 409);
  const approval = await prisma.requestApproval.findUnique({ where: { requestId_approverId: { requestId: request.id, approverId } } });
  if (!approval) throw new RequestError('You are not an approver for this request', 403);
  if (approval.state !== 'PENDING') throw new RequestError('You have already decided on this request', 409);

  const now = new Date();
  const item = await prisma.serviceCatalogItem.findUnique({ where: { id: request.catalogItemId }, select: { fulfillmentHours: true } });
  const [, updated] = await prisma.$transaction([
    prisma.requestApproval.update({
      where: { id: approval.id },
      data: { state: approve ? 'APPROVED' : 'REJECTED', comments: comments ? String(comments).slice(0, 2000) : null, decidedAt: now },
    }),
    prisma.serviceRequest.update({
      where: { id: request.id },
      data: approve
        ? { state: 'APPROVED', approvedAt: now, dueAt: hoursFrom(now, item?.fulfillmentHours) }
        : { state: 'REJECTED', closedAt: now, resolutionNotes: comments || 'Rejected by approver' },
    }),
  ]);

  createNotification(request.requestedById, 'SYSTEM', `${request.number} ${approve ? 'approved' : 'rejected'}`,
    approve ? 'Your request was approved and is being fulfilled.' : `Your request was rejected${comments ? `: ${comments}` : '.'}`,
    `/portal/requests/${request.id}`);
  return updated;
}

async function transition({ request, to, actor, resolutionNotes }) {
  const allowed = REQUEST_TRANSITIONS[request.state] || [];
  if (!allowed.includes(to)) throw new RequestError(`Cannot move a ${request.state} request to ${to}`, 409);
  if (to === 'APPROVED' || to === 'REJECTED') {
    if (request.state === 'PENDING_APPROVAL') throw new RequestError('Use the approval action to approve or reject', 409);
  }
  const now = new Date();
  const data = { state: to };
  if (to === 'FULFILLED') { data.fulfilledAt = now; data.closedAt = now; }
  if (to === 'CANCELLED' || to === 'REJECTED') data.closedAt = now;
  if (resolutionNotes !== undefined) data.resolutionNotes = resolutionNotes ? String(resolutionNotes).slice(0, 5000) : null;
  if (to === 'IN_FULFILLMENT' && !request.assignedToId && actor) data.assignedToId = actor.id;

  const updated = await prisma.serviceRequest.update({ where: { id: request.id }, data });
  if (to === 'FULFILLED' && actor?.id !== request.requestedById) {
    createNotification(request.requestedById, 'SYSTEM', `${request.number} fulfilled`,
      'Your request is complete. Let us know how we did.', `/portal/requests/${request.id}`);
  }
  return updated;
}

function validateCsat(score, comment) {
  const n = Number(score);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new RequestError('Rating must be a whole number from 1 to 5');
  if (comment !== undefined && comment !== null && String(comment).length > 2000) throw new RequestError('Comment is too long (max 2000 characters)');
  return { csatScore: n, csatComment: comment ? String(comment) : null, csatAt: new Date() };
}

module.exports = {
  RequestError, validateFormSchema, validateFormData, findApprovers,
  createRequest, decide, transition, validateCsat,
};
