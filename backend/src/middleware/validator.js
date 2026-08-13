// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Request Validators (express-validator)
// ═══════════════════════════════════════════════════════════

const { body, param, query, validationResult } = require('express-validator');
const { INCIDENT_STATES, CHANGE_STATES, PROBLEM_STATES, PRIORITIES, IMPACTS, URGENCIES } = require('../config/constants');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
  }
  next();
}

// ── Incident ────────────────────────────────────────────

const validateIncidentCreate = [
  body('shortDescription').trim().isLength({ min: 3, max: 200 }).withMessage('Short description: 3-200 chars'),
  body('impact').optional().isIn(IMPACTS),
  body('urgency').optional().isIn(URGENCIES),
  body('category').optional().trim().isLength({ max: 100 }),
  body('subcategory').optional().trim().isLength({ max: 100 }),
  body('assignmentGroupId').optional().isUUID(),
  body('assignedToId').optional().isUUID(),
  body('configItemId').optional().isUUID(),
  body('description').optional().trim(),
  validate,
];

const validateIncidentUpdate = [
  param('id').isUUID(),
  body('state').optional().isIn(INCIDENT_STATES),
  body('priority').optional().isIn(PRIORITIES),
  body('assignedToId').optional().isUUID(),
  body('assignmentGroupId').optional().isUUID(),
  body('resolutionCode').optional().trim(),
  body('resolutionNotes').optional().trim(),
  validate,
];

// ── Change ──────────────────────────────────────────────

const validateChangeCreate = [
  body('shortDescription').trim().isLength({ min: 3, max: 200 }),
  body('type').optional().isIn(['NORMAL', 'STANDARD', 'EMERGENCY']),
  body('riskLevel').optional().isIn(['HIGH', 'MEDIUM', 'LOW']),
  body('justification').optional().trim(),
  body('implementationPlan').optional().trim(),
  body('rollbackPlan').optional().trim(),
  body('assignmentGroupId').optional().isUUID(),
  body('assignedToId').optional().isUUID(),
  validate,
];

const validateChangeUpdate = [
  param('id').isUUID(),
  body('state').optional().isIn(CHANGE_STATES),
  body('riskLevel').optional().isIn(['HIGH', 'MEDIUM', 'LOW']),
  body('closureCode').optional().isIn(['SUCCESSFUL', 'FAILED', 'PARTIAL']),
  validate,
];

// ── Problem ─────────────────────────────────────────────

const validateProblemCreate = [
  body('shortDescription').trim().isLength({ min: 3, max: 200 }),
  body('priority').optional().isIn(PRIORITIES),
  body('category').optional().trim(),
  body('assignmentGroupId').optional().isUUID(),
  body('assignedToId').optional().isUUID(),
  validate,
];

const validateProblemUpdate = [
  param('id').isUUID(),
  body('state').optional().isIn(PROBLEM_STATES),
  body('rootCause').optional().trim(),
  body('workaround').optional().trim(),
  validate,
];

// ── Common ──────────────────────────────────────────────

const validatePagination = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sortBy').optional().trim(),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  validate,
];

const validateUUID = [param('id').isUUID().withMessage('Invalid ID format'), validate];

const validateWorkNote = [
  body('content').trim().isLength({ min: 1, max: 10000 }).withMessage('Content required (max 10000 chars)'),
  body('isInternal').optional().isBoolean(),
  validate,
];

module.exports = {
  validate,
  validateIncidentCreate, validateIncidentUpdate,
  validateChangeCreate, validateChangeUpdate,
  validateProblemCreate, validateProblemUpdate,
  validatePagination, validateUUID, validateWorkNote,
};
