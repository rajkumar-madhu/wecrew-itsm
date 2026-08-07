// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Helper Utilities
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { PRIORITY_MATRIX, SLA_DEFAULTS, PAGINATION } = require('../config/constants');

// ── Number Generators ────────────────────────────────────

async function generateIncidentNumber() {
  const last = await prisma.incident.findFirst({ orderBy: { number: 'desc' }, select: { number: true } });
  const seq = last ? parseInt(last.number.replace('INC', ''), 10) + 1 : 1;
  return `INC${String(seq).padStart(7, '0')}`;
}

async function generateChangeNumber() {
  const last = await prisma.change.findFirst({ orderBy: { number: 'desc' }, select: { number: true } });
  const seq = last ? parseInt(last.number.replace('CHG', ''), 10) + 1 : 1;
  return `CHG${String(seq).padStart(7, '0')}`;
}

async function generateProblemNumber() {
  const last = await prisma.problem.findFirst({ orderBy: { number: 'desc' }, select: { number: true } });
  const seq = last ? parseInt(last.number.replace('PRB', ''), 10) + 1 : 1;
  return `PRB${String(seq).padStart(7, '0')}`;
}

// ── Priority & SLA ──────────────────────────────────────

function calculatePriority(impact, urgency) {
  return (PRIORITY_MATRIX[impact] && PRIORITY_MATRIX[impact][urgency]) || 'P4';
}

function getSLATargets(priority) {
  return SLA_DEFAULTS[priority] || SLA_DEFAULTS.P4;
}

function calculateSLATargetTimes(priority, createdAt) {
  const sla = getSLATargets(priority);
  const base = new Date(createdAt);
  return {
    slaTargetResponse: new Date(base.getTime() + sla.response * 60000),
    slaTargetResolution: new Date(base.getTime() + sla.resolution * 60000),
  };
}

// ── Pagination ──────────────────────────────────────────

function paginate(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || PAGINATION.defaultPage);
  const l = Math.min(PAGINATION.maxLimit, Math.max(1, parseInt(limit, 10) || PAGINATION.defaultLimit));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

function paginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return { total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

// ── Response Formatters ─────────────────────────────────

function success(res, data, status = 200, pagination = null) {
  const body = { success: true, data };
  if (pagination) body.pagination = pagination;
  return res.status(status).json(body);
}

function error(res, message, status = 400, details = null) {
  const body = { success: false, error: message };
  if (details) body.details = details;
  return res.status(status).json(body);
}

// ── Misc ────────────────────────────────────────────────

function sanitizeObject(obj, allowedFields) {
  const result = {};
  for (const key of allowedFields) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

module.exports = {
  generateIncidentNumber, generateChangeNumber, generateProblemNumber,
  calculatePriority, getSLATargets, calculateSLATargetTimes,
  paginate, paginationMeta, success, error, sanitizeObject,
};
