// Update all escalation rules to production delays:
// L1: 30 min, L2: 60 min, L3: 360 min (6h)
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const l1 = await p.escalationRule.updateMany({ where: { level: 1 }, data: { delayMinutes: 30 } });
  const l2 = await p.escalationRule.updateMany({ where: { level: 2 }, data: { delayMinutes: 60 } });
  const l3 = await p.escalationRule.updateMany({ where: { level: 3 }, data: { delayMinutes: 360 } });

  console.log('L1 rules updated:', l1.count, '→ 30 min');
  console.log('L2 rules updated:', l2.count, '→ 60 min');
  console.log('L3 rules updated:', l3.count, '→ 360 min (6h)');

  // Verify DevOps Team
  const pol = await p.escalationPolicy.findFirst({
    where: { team: { name: 'DevOps Team', organizationId: '78b981f8-4df8-4c74-8a59-c9ea3fd8be6c' } },
    include: { rules: { orderBy: { level: 'asc' } } }
  });
  console.log('\nDevOps Team (Lemonn) verified:');
  pol.rules.forEach(r => console.log('  L' + r.level + ': ' + r.delayMinutes + 'min → ' + r.notifyTargets));
}

main().catch(console.error).finally(() => p.$disconnect());
