// Show escalation chains for all 5 team types (using Lemonn as reference)
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const LEMONN_ORG = '78b981f8-4df8-4c74-8a59-c9ea3fd8be6c';

  const teams = await p.team.findMany({
    where: {
      name: { in: ['LE Team', 'DevOps Team', 'Network Team', 'DB Team', 'Management Team'] },
      organizationId: LEMONN_ORG
    },
    include: {
      escalationPolicies: {
        where: { isActive: true },
        include: { rules: { orderBy: { level: 'asc' } } }
      }
    },
    orderBy: { name: 'asc' }
  });

  teams.forEach(t => {
    const pol = t.escalationPolicies[0];
    console.log('\nTeam:', t.name);
    if (!pol) { console.log('  ❌ NO ACTIVE POLICY'); return; }
    pol.rules.forEach(r => {
      console.log('  L' + r.level + ' (' + r.delayMinutes + 'min): ' + r.notifyTargets);
    });
  });

  // Also show category routing
  console.log('\n--- Alert Category → Team Routing ---');
  console.log('Network / Hardware / Storage / Security → Network Team');
  console.log('Application / Infrastructure / Monitoring / Cloud → DevOps Team');
  console.log('Database → DB Team');
  console.log('Other → DevOps Team');
}

main().catch(console.error).finally(() => p.$disconnect());
