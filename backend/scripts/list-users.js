const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const users = await p.user.findMany({
    select: {
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      organization: { select: { name: true, environment: true } }
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }]
  });

  // Group by org
  const grouped = {};
  users.forEach(u => {
    const org = u.organization ? u.organization.name : '(No Organization — Super Admin / Global)';
    if (!grouped[org]) grouped[org] = [];
    grouped[org].push(u);
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ARGUS ITSM — User Credentials');
  console.log('  Default password (all seeded users): Wecrew@2026');
  console.log('═══════════════════════════════════════════════════════════\n');

  const orgNames = Object.keys(grouped).sort();
  for (const org of orgNames) {
    const orgUsers = grouped[org];
    console.log('┌─ ' + org + ' (' + orgUsers.length + ' users)');
    orgUsers.forEach((u, i) => {
      const prefix = i === orgUsers.length - 1 ? '└──' : '├──';
      console.log(prefix + ' ' + u.email + ' | ' + u.role + ' | ' + u.firstName + ' ' + u.lastName);
    });
    console.log('');
  }

  console.log('Total users:', users.length);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
