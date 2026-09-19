// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Seed billing tiers. Idempotent — safe to re-run on deploy.
//
// razorpayPlanId is read from env because the Razorpay plan must be
// created in the dashboard first; without it, STARTER cannot be checked out.
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TIERS = [
  { tier: 'TRIAL', name: 'Trial', amount: null, seatLimit: 10, period: 'none',
    description: '20-day free trial. No card required.', razorpayPlanId: null },
  { tier: 'STARTER', name: 'Starter', amount: 3000000, seatLimit: 10, period: 'yearly',
    description: '10 agent seats. Unlimited viewers.',
    razorpayPlanId: process.env.RAZORPAY_STARTER_PLAN_ID || null },
  { tier: 'ENTERPRISE', name: 'Enterprise', amount: null, seatLimit: 9999, period: 'yearly',
    description: 'Custom seats and terms. Talk to sales.', razorpayPlanId: null },
];

async function main() {
  for (const t of TIERS) {
    await prisma.plan.upsert({
      where: { tier: t.tier },
      update: { name: t.name, amount: t.amount, seatLimit: t.seatLimit,
                period: t.period, description: t.description, razorpayPlanId: t.razorpayPlanId },
      create: t,
    });
    console.log(`[seed] ${t.tier}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
