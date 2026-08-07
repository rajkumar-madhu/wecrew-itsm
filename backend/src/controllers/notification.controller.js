// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Notification Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { paginate, paginationMeta, success, error } = require('../utils/helpers');

// GET /api/v1/notifications
async function listNotifications(req, res, next) {
  try {
    const { isRead } = req.query;
    const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);

    const where = { userId: req.user.id };
    if (isRead !== undefined) where.isRead = isRead === 'true';

    const [notifications, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    return success(res, { notifications, unreadCount }, 200, paginationMeta(total, page, limit));
  } catch (err) { next(err); }
}

// PATCH /api/v1/notifications/:id/read
async function markAsRead(req, res, next) {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true, readAt: new Date() },
    });
    return success(res, notification);
  } catch (err) { next(err); }
}

// POST /api/v1/notifications/read-all
async function markAllAsRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return success(res, { message: 'All notifications marked as read' });
  } catch (err) { next(err); }
}

// GET /api/v1/notifications/unread-count
async function getUnreadCount(req, res, next) {
  try {
    const count = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
    return success(res, { count });
  } catch (err) { next(err); }
}

module.exports = { listNotifications, markAsRead, markAllAsRead, getUnreadCount };
