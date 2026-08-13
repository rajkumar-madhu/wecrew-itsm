// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — AI Routes (Claude + OpenAI Fallback)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { cacheMiddleware } = require('../config/redis');
const ctrl = require('../controllers/ai.controller');

router.use(authenticate);

router.get('/stats', cacheMiddleware('ai:stats', 30), ctrl.getAIStats);
router.get('/classifications', ctrl.getClassifications);
router.get('/suggestions', ctrl.getSuggestions);
router.post('/chat', ctrl.chat);

module.exports = router;
