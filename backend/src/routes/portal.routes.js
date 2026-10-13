// ═══════════════════════════════════════════════════════════
// Argus ITSM — Self-service Portal Routes
// Open to every signed-in user; each handler scopes to the caller's own records.
// ═══════════════════════════════════════════════════════════

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validateUUID } = require('../middleware/validator');
const ctrl = require('../controllers/portal.controller');

const router = Router();
router.use(authenticate);

router.get('/catalog', ctrl.listCatalog);

router.get('/requests', ctrl.listMyRequests);
router.post('/requests', ctrl.createRequest);
router.get('/requests/:id', validateUUID, ctrl.getMyRequest);
router.post('/requests/:id/comments', validateUUID, ctrl.commentOnRequest);
router.post('/requests/:id/cancel', validateUUID, ctrl.cancelRequest);
router.post('/requests/:id/rating', validateUUID, ctrl.rateRequest);

router.get('/incidents', ctrl.listMyIncidents);
router.post('/incidents', ctrl.reportIncident);
router.get('/incidents/:id', validateUUID, ctrl.getMyIncident);
router.post('/incidents/:id/comments', validateUUID, ctrl.commentOnIncident);
router.post('/incidents/:id/rating', validateUUID, ctrl.rateIncident);

router.get('/knowledge', ctrl.searchArticles);
router.get('/knowledge/:id', validateUUID, ctrl.getArticle);
router.post('/knowledge/:id/feedback', validateUUID, ctrl.articleFeedback);

module.exports = router;
