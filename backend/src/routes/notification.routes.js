// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Notification Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validatePagination, validateUUID } = require('../middleware/validator');
const ctrl = require('../controllers/notification.controller');

router.use(authenticate);

router.get('/', validatePagination, ctrl.listNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.patch('/:id/read', validateUUID, ctrl.markAsRead);
router.post('/read-all', ctrl.markAllAsRead);

module.exports = router;
