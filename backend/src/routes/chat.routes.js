// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Team Chat Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const ctrl = require('../controllers/chat.controller');

router.use(authenticate);

const teamIdParam = [param('teamId').isUUID().withMessage('Invalid team id'), validate];

router.get('/teams', ctrl.listChatTeams);
router.get('/teams/:teamId/messages', teamIdParam, ctrl.listMessages);
router.post('/teams/:teamId/messages', teamIdParam, ctrl.sendMessage);

module.exports = router;
