// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Auth Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validator');
const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/auth.controller');

router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  validate,
], ctrl.login);

router.post('/signup', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  validate,
], ctrl.signup);

router.post('/register', authenticate, authorize('ADMIN'), [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').optional().isIn(['ADMIN', 'MANAGER', 'ENGINEER', 'OPERATOR', 'VIEWER']),
  validate,
], ctrl.register);

router.get('/users', authenticate, ctrl.listUsers);
router.post('/refresh', ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.getProfile);
router.put('/me', authenticate, ctrl.updateProfile);

router.post('/change-password', authenticate, [
  body('oldPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  validate,
], ctrl.changePassword);

module.exports = router;
