// Reassign INC0000032 to DevOps Team and reset for escalation test
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const LEMONN_ORG = '78b981f8-4df8-4c74-8a59-c9ea3fd8be6c';

  const devops = await p.team.findFirst({
    where: { name: 'DevOps Team', organizationId: LEMONN_ORG }
  });
  console.log('DevOps Team:', devops.name, devops.id);

  // Reassign + reset state so escalation engine picks it up
  // Set createdAt to 6 minutes ago — L1 rule fires at 5min, so L1 will trigger on next cycle
  const sixMinsAgo = new Date(Date.now() - 6 * 60 * 1000);
  const updated = await p.incident.updateMany({
    where: { number: 'INC0000032' },
    data: {
      assignmentGroupId: devops.id,
      state: 'NEW',
      escalationLevel: 0,
      lastEscalatedAt: null,
      createdAt: sixMinsAgo,
    }
  });
  console.log('Updated rows:', updated.count);

  const inc = await p.incident.findFirst({
    where: { number: 'INC0000032' },
    select: { number: true, state: true, escalationLevel: true, createdAt: true, assignmentGroupId: true }
  });
  console.log('INC0000032 now:', inc);
  console.log('createdAt set to 6 mins ago — L1 (5min rule) will fire on next 60s cycle');
}

main().catch(console.error).finally(() => p.$disconnect());
