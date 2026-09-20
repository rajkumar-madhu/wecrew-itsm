// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Billing service (DB-only)
//
// Access state is DERIVED on every call, never stored. A stored flag
// flipped by a cron means one missed run silently gives expired orgs
// free product — invisible until someone audits revenue.
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');

const TRIAL_DAYS = 20;
const TRIAL_SEATS = 10;
const DAY_MS = 86400000;

async function startTrial(client, organizationId) {
  return client.subscription.create({
    data: {
      organizationId,
      tier: 'TRIAL',
      status: 'TRIALING',
      seatLimit: TRIAL_SEATS,
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * DAY_MS),
    },
  });
}

function countBillableSeats(organizationId) {
  return prisma.user.count({
    where: { organizationId, status: 'ACTIVE', role: { not: 'VIEWER' } },
  });
}

async function getAccessState(organizationId) {
  let sub = await prisma.subscription.findUnique({ where: { organizationId } });

  // No row = unpaid / never provisioned. Fail CLOSED so staff-created orgs
  // cannot silently get permanent free write access. Lazy-start a trial so
  // legacy tenants that pre-date billing are not locked out on deploy — the
  // create is raced safely via the unique organizationId constraint.
  if (!sub) {
    try {
      sub = await startTrial(prisma, organizationId);
    } catch (err) {
      if (err.code === 'P2002') {
        sub = await prisma.subscription.findUnique({ where: { organizationId } });
      } else {
        throw err;
      }
    }
    if (!sub) {
      return {
        tier: 'NONE', status: 'NONE', isReadOnly: true, daysRemaining: null,
        trialEndsAt: null, currentPeriodEnd: null, seatsUsed: 0, seatLimit: null,
      };
    }
  }

  const now = Date.now();
  const trialExpired = sub.status === 'TRIALING' && sub.trialEndsAt.getTime() < now;
  const periodExpired = sub.status === 'CANCELLED'
    && (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() < now);

  // PAST_DUE stays writable so the customer can reach /billing and update the
  // mandate; HALTED/EXPIRED/ended-trial are read-only.
  const isReadOnly = trialExpired
    || sub.status === 'HALTED'
    || sub.status === 'EXPIRED'
    || periodExpired;

  const daysRemaining = sub.status === 'TRIALING'
    ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now) / DAY_MS))
    : null;

  return {
    tier: sub.tier,
    status: sub.status,
    isReadOnly,
    daysRemaining,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
    seatsUsed: await countBillableSeats(organizationId),
    seatLimit: sub.seatLimit,
  };
}

/**
 * Tell the org's connected users their billing state changed so the banner
 * and /billing refetch. Per-user rooms, never emitToAll: another tenant must
 * not learn that this org paid, lapsed or cancelled. Best-effort — sockets
 * are optional and a failure here must never fail the billing write.
 */
async function notifySubscriptionChanged(organizationId) {
  try {
    const { emitToUser } = require('../config/socket');
    const users = await prisma.user.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { id: true },
    });
    users.forEach((u) => emitToUser(u.id, 'subscription:updated', { organizationId }));
  } catch { /* socket fan-out is optional */ }
}

module.exports = {
  startTrial, getAccessState, countBillableSeats, notifySubscriptionChanged,
  TRIAL_DAYS, TRIAL_SEATS,
};
