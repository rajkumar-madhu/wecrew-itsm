// Check escalation policies + INC0000032 team assignment
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 1. Find the incident and its team
  const inc = await p.incident.findFirst({
    where: { number: 'INC0000032' },
    include: {
      organization: true,
      assignmentGroup: {
        include: {
          escalationPolicies: {
            include: { rules: { orderBy: { level: 'asc' } } }
          }
        }
      }
    }
  });

  console.log('=== INC0000032 ===');
  console.log('State:', inc.state, '| EscalationLevel:', inc.escalationLevel);
  console.log('Org:', inc.organization.name, '|', inc.organizationId);
  console.log('Team:', inc.assignmentGroup.name, '|', inc.assignmentGroupId);

  const policies = inc.assignmentGroup.escalationPolicies;
  console.log('Escalation policies:', policies.length);
  policies.forEach(pol => {
    console.log('  Policy:', pol.name, '| isActive:', pol.isActive);
    pol.rules.forEach(r => {
      console.log('    L' + r.level + ': ' + r.delayMinutes + 'min | ' + r.notifyType + ' | targets: ' + r.notifyTargets + ' | conditionPriority: ' + (r.conditionPriority || 'any'));
    });
  });

  // 2. Find DevOps team in same org with active policy
  console.log('\n=== Lemonn Org Teams with Active Policies ===');
  const teams = await p.team.findMany({
    where: { organizationId: inc.organizationId },
    include: {
      escalationPolicies: {
        where: { isActive: true },
        include: { rules: { orderBy: { level: 'asc' } } }
      }
    }
  });

  teams.forEach(t => {
    const pol = t.escalationPolicies[0];
    console.log('Team:', t.name, '| policies:', t.escalationPolicies.length);
    if (pol) {
      pol.rules.forEach(r => {
        console.log('  L' + r.level + ': ' + r.delayMinutes + 'min | targets: ' + r.notifyTargets + ' | priority: ' + (r.conditionPriority || 'any'));
      });
    }
  });
}

main().catch(console.error).finally(() => p.$disconnect());
