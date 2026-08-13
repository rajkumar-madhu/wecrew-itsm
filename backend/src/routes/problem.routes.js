// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Problem Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const { validateProblemCreate, validateProblemUpdate, validateUUID, validatePagination, validateWorkNote } = require('../middleware/validator');
const { auditLog } = require('../middleware/audit');
const ctrl = require('../controllers/problem.controller');

router.use(authenticate);

router.get('/', checkPermission('problems', 'read'), validatePagination, ctrl.listProblems);
router.get('/stats', checkPermission('problems', 'read'), ctrl.getProblemStats);
router.get('/:id', checkPermission('problems', 'read'), validateUUID, ctrl.getProblem);
router.post('/', checkPermission('problems', 'create'), validateProblemCreate, auditLog('Problem'), ctrl.createProblem);
router.patch('/:id', checkPermission('problems', 'update'), validateProblemUpdate, auditLog('Problem'), ctrl.updateProblem);
router.patch('/:id/rca', checkPermission('problems', 'update'), validateUUID, ctrl.updateRCA);
router.post('/:id/notes', checkPermission('problems', 'update'), validateUUID, validateWorkNote, ctrl.addWorkNote);
router.post('/:id/ai-rca', checkPermission('problems', 'update'), validateUUID, ctrl.aiRCA);

module.exports = router;
