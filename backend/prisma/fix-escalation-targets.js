// Fix escalation rule notifyTargets to use actual User email addresses
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 1. Show actual user emails
  const users = await p.user.findMany({
    where: { email: { in: [
      'rajkumar.madhu@wecrew.in', 'rajkumar.madhu@rmadhu.in',
      'hoysala.bise@wecrew.in', 'siva.kadirannagari@wecrew.in',
      'rajkumar.ashokan@wecrew.in', 'edukondalu.p@wecrew.in',
      'devendrareddy.puppala@wecrew.in', 'shrikant.pandit@wecrew.in',
    ] } },
    select: { email: true, firstName: true, lastName: true }
  });
  console.log('Users in DB:');
  users.forEach(u => console.log(' ', u.email, '-', u.firstName, u.lastName));

  // 2. Fix all escalation rules with the wrong email
  const wrongEmail = await p.escalationRule.updateMany({
    where: { notifyTargets: { contains: 'rajkumar.madhu@rmadhu.in' } },
    data: { notifyTargets: 'rajkumar.madhu@wecrew.in' }
  });
  console.log('\nFixed rules with @rmadhu.in:', wrongEmail.count);

  // 3. Show DevOps Team rules after fix
  const devopsPolicy = await p.escalationPolicy.findFirst({
    where: { team: { name: 'DevOps Team', organizationId: '78b981f8-4df8-4c74-8a59-c9ea3fd8be6c' } },
    include: { rules: { orderBy: { level: 'asc' } } }
  });
  if (devopsPolicy) {
    console.log('\nDevOps Team policy rules after fix:');
    devopsPolicy.rules.forEach(r => {
      console.log('  L' + r.level + ': ' + r.delayMinutes + 'min | targets: ' + r.notifyTargets);
    });
  }

  // 4. Reset INC0000032 for a clean escalation test
  // Set createdAt to 4 min ago — L1 fires at 5min, so in next 60s cycle L1 will fire
  const fourMinsAgo = new Date(Date.now() - 4 * 60 * 1000);
  await p.incident.updateMany({
    where: { number: 'INC0000032' },
    data: { escalationLevel: 0, lastEscalatedAt: null, state: 'NEW', createdAt: fourMinsAgo }
  });
  console.log('\nINC0000032 reset: escalationLevel=0, state=NEW, createdAt=4min ago');
  console.log('L1 (5min) fires in ~60s, L2 (15min) fires in ~11min');
}

main().catch(console.error).finally(() => p.$disconnect());
