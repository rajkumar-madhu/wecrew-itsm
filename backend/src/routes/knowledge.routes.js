// ═══════════════════════════════════════════════════════════
// Argus ITSM — Knowledge Article Routes (agents)
// ═══════════════════════════════════════════════════════════

const { Router } = require('express');
const { param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { enforceWriteAccess } = require('../middleware/billing.middleware');
const { validateUUID } = require('../middleware/validator');
const { validate } = require('../middleware/validator');
const { auditLog } = require('../middleware/audit');
const { AGENT_ROLES } = require('../config/constants');
const ctrl = require('../controllers/knowledge.controller');

const router = Router();
router.use(authenticate, authorize(...AGENT_ROLES), enforceWriteAccess);
const WRITERS = ['ADMIN', 'MANAGER', 'ENGINEER', 'OPERATOR'];

router.get('/', ctrl.listArticles);
router.post('/', authorize(...WRITERS), auditLog('KnowledgeArticle'), ctrl.createArticle);
router.post('/from-incident/:incidentId', authorize(...WRITERS), [param('incidentId').isUUID(), validate], auditLog('KnowledgeArticle'), ctrl.draftFromIncident);
router.get('/:id', validateUUID, ctrl.getArticle);
router.patch('/:id', authorize(...WRITERS), validateUUID, auditLog('KnowledgeArticle'), ctrl.updateArticle);
router.post('/:id/feedback', validateUUID, ctrl.feedback);
router.post('/:id/:action(submit|publish|reject|retire|restore)', authorize(...WRITERS), validateUUID, auditLog('KnowledgeArticle'), ctrl.moveArticle);

module.exports = router;
