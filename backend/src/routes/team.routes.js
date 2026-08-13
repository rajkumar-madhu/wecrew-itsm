// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Team Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate, authorize, checkPermission } = require('../middleware/auth');
const { validateUUID, validatePagination, validate } = require('../middleware/validator');
const { body } = require('express-validator');
const ctrl = require('../controllers/team.controller');

router.use(authenticate);

router.get('/', checkPermission('teams', 'read'), validatePagination, ctrl.listTeams);
router.get('/on-call/overview', checkPermission('teams', 'read'), ctrl.getOnCallOverview);
router.get('/:id', checkPermission('teams', 'read'), validateUUID, ctrl.getTeam);
router.post('/', checkPermission('teams', 'create'), [
  body('name').trim().isLength({ min: 2, max: 100 }),
  validate,
], ctrl.createTeam);
router.patch('/:id', checkPermission('teams', 'update'), validateUUID, ctrl.updateTeam);

router.post('/:id/members', checkPermission('teams', 'update'), validateUUID, [
  body('userId').isUUID(),
  body('role').optional().isIn(['LEAD', 'MEMBER', 'OBSERVER']),
  validate,
], ctrl.addMember);
router.delete('/:id/members/:userId', checkPermission('teams', 'update'), ctrl.removeMember);

router.get('/:id/on-call', checkPermission('teams', 'read'), validateUUID, ctrl.getOnCall);
router.get('/:id/on-call/history', checkPermission('teams', 'read'), validateUUID, validatePagination, ctrl.getOnCallHistory);
router.post('/:id/on-call', authorize('ADMIN', 'MANAGER'), validateUUID, [
  body('userId').isUUID(),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  body('isPrimary').optional().isBoolean(),
  validate,
], ctrl.createOnCallSchedule);
router.get('/:id/escalation', checkPermission('teams', 'read'), validateUUID, ctrl.getEscalationPolicies);
router.post('/:id/escalation-policies', authorize('ADMIN', 'MANAGER'), validateUUID, [
  body('name').trim().isLength({ min: 1, max: 100 }),
  validate,
], ctrl.createEscalationPolicy);
router.put('/:id/escalation-policies/:policyId', authorize('ADMIN', 'MANAGER'), validateUUID, ctrl.updateEscalationPolicy);
router.delete('/:id/escalation-policies/:policyId', authorize('ADMIN', 'MANAGER'), ctrl.deleteEscalationPolicy);

module.exports = router;
