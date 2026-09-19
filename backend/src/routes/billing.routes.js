// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Billing Routes
// Mounted at /api/v1/billing. Exempt from enforceWriteAccess so a
// locked-out org can still reach checkout.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const ctrl = require('../controllers/billing.controller');

router.use(authenticate);

router.get('/plans', ctrl.listPlans);
router.get('/subscription', ctrl.getSubscription);

router.post('/subscribe', authorize('ADMIN'), [
  body('tier').isIn(['STARTER', 'ENTERPRISE']),
  validate,
], ctrl.subscribe);

router.post('/verify', authorize('ADMIN'), [
  body('razorpay_payment_id').isString().notEmpty(),
  body('razorpay_subscription_id').isString().notEmpty(),
  body('razorpay_signature').isString().notEmpty(),
  validate,
], ctrl.verify);

router.post('/cancel', authorize('ADMIN'), ctrl.cancel);

module.exports = router;
