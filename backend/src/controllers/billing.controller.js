// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Billing controller
//
// /verify is a UX nicety only. The webhook is authoritative:
// a customer who closes the tab mid-redirect has still paid.
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');
const { getAccessState, notifySubscriptionChanged } = require('../services/billing.service');
const rzp = require('../services/razorpay.service');

// A subscription in these states is still billing the customer.
const LIVE_STATUSES = new Set(['ACTIVE', 'PAST_DUE']);

async function listPlans(_req, res, next) {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { amount: 'asc' },
      select: { tier: true, name: true, description: true, amount: true,
                currency: true, period: true, seatLimit: true },
    });
    return success(res, plans);
  } catch (err) { next(err); }
}

async function getSubscription(req, res, next) {
  try {
    if (!req.user.organizationId) return error(res, 'No organization on this account', 400);
    return success(res, await getAccessState(req.user.organizationId));
  } catch (err) { next(err); }
}

async function subscribe(req, res, next) {
  try {
    const orgId = req.user.organizationId;
    if (!orgId) return error(res, 'No organization on this account', 400);

    const { tier } = req.body;
    const plan = await prisma.plan.findUnique({ where: { tier } });
    if (!plan) return error(res, 'Unknown plan tier', 400);
    if (!plan.razorpayPlanId) {
      return error(res, 'This plan is not available for self-serve checkout. Contact sales.', 400);
    }

    const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!sub) return error(res, 'No subscription record for this organization', 404);

    // A second subscription for a paying org would charge them twice, and
    // overwriting razorpaySubscriptionId would orphan the one still billing.
    if (sub.razorpaySubscriptionId && LIVE_STATUSES.has(sub.status)) {
      return error(res, 'This organization already has an active subscription', 409);
    }

    let customerId = sub.razorpayCustomerId;
    if (!customerId) {
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      const customer = await rzp.createCustomer({
        name: org.name,
        email: req.user.email,
        contact: req.user.phone || undefined,
      });
      customerId = customer.id;
    }

    const created = await rzp.createSubscription({
      planId: plan.razorpayPlanId,
      organizationId: orgId,
    });

    await prisma.subscription.update({
      where: { organizationId: orgId },
      data: {
        razorpaySubscriptionId: created.id,
        razorpayCustomerId: customerId,
        razorpayPlanId: plan.razorpayPlanId,
      },
    });

    logger.info(`[billing] subscription ${created.id} created for org ${orgId} (${tier})`);

    return success(res, {
      subscriptionId: created.id,
      shortUrl: created.short_url,
      keyId: rzp.getKeyId(),
      tier: plan.tier,
      amount: plan.amount,
      currency: plan.currency,
    });
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    const {
      razorpay_payment_id: paymentId,
      razorpay_subscription_id: subscriptionId,
      razorpay_signature: signature,
    } = req.body;

    if (!rzp.verifySubscriptionSignature({ paymentId, subscriptionId, signature })) {
      logger.warn(`[billing] signature verification FAILED for subscription ${subscriptionId}`);
      return error(res, 'Payment verification failed', 400);
    }

    const sub = await prisma.subscription.findUnique({
      where: { organizationId: req.user.organizationId },
    });
    if (!sub || sub.razorpaySubscriptionId !== subscriptionId) {
      return error(res, 'Subscription does not belong to this organization', 403);
    }

    const plan = sub.razorpayPlanId
      ? await prisma.plan.findUnique({ where: { razorpayPlanId: sub.razorpayPlanId } })
      : null;

    // Optimistic. subscription.activated from the webhook is the real transition.
    const updated = await prisma.subscription.update({
      where: { organizationId: req.user.organizationId },
      data: {
        status: 'ACTIVE',
        tier: plan ? plan.tier : sub.tier,
        seatLimit: plan ? plan.seatLimit : sub.seatLimit,
      },
    });

    logger.info(`[billing] org ${req.user.organizationId} activated via checkout callback`);
    notifySubscriptionChanged(req.user.organizationId);
    return success(res, { status: updated.status });
  } catch (err) { next(err); }
}

async function cancel(req, res, next) {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { organizationId: req.user.organizationId },
    });
    if (!sub || !sub.razorpaySubscriptionId) return error(res, 'No active subscription', 404);

    await rzp.cancelSubscription(sub.razorpaySubscriptionId, true);
    await prisma.subscription.update({
      where: { organizationId: req.user.organizationId },
      data: { cancelledAt: new Date() },
    });

    logger.info(`[billing] org ${req.user.organizationId} cancelled at cycle end`);
    notifySubscriptionChanged(req.user.organizationId);
    return success(res, { cancelled: true, accessUntil: sub.currentPeriodEnd });
  } catch (err) { next(err); }
}

module.exports = { listPlans, getSubscription, subscribe, verify, cancel };
