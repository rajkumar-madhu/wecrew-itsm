// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Seed: 16 Client Organizations
// Run: node prisma/seed-organizations.js
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const ORGANIZATIONS = [
  { name: 'IndMoney DR Bangalore',  slug: 'fs-blr-indmoney-dr-le',    environment: 'DR',   serverIp: '10.10.10.110',    fqdn: 'fs-blr-indmoney-dr-le.linkedeye.local' },
  { name: 'IndMoney Mumbai Prod',   slug: 'fs-mum-indmoney-prod-le',  environment: 'PROD', serverIp: '10.172.0.10',     fqdn: 'fs-mum-indmoney-prod-le.linkedeye.local' },
  { name: 'FinSpot DR',             slug: 'fs-dr-le',                 environment: 'DR',   serverIp: '10.173.0.10',     fqdn: 'fs-dr-le.linkedeye.local' },
  { name: 'PL India Prod',          slug: 'pl-prod-le',               environment: 'PROD', serverIp: '10.40.1.10',      fqdn: 'pl-prod-le.linkedeye.local' },
  { name: 'Neo Prod',               slug: 'neo-prod-le',              environment: 'PROD', serverIp: '10.40.40.23',     fqdn: 'neo-prod-le.linkedeye.local' },
  { name: 'FlatTrade FTC',          slug: 'ftc-mum-finspot-le',       environment: 'PROD', serverIp: '202.87.54.194',   fqdn: 'ftc-mum-finspot-le.linkedeye.local' },
  { name: 'FinSpot ISV',             slug: 'fs-le-isv',                environment: 'PROD', serverIp: '10.10.0.101',     fqdn: 'fs-le-isv.linkedeye.local' },
  { name: 'Way2Wealth W2W',         slug: 'fs-w2w-le',                environment: 'PROD', serverIp: '192.168.12.109',  fqdn: 'fs-w2w-le.linkedeye.local' },
  { name: 'FinSpot IFSC',           slug: 'fs-ifsc-le',               environment: 'PROD', serverIp: '10.200.1.18',     fqdn: 'fs-ifsc-le.linkedeye.local' },
  { name: 'IndMoney IFSC',          slug: 'indmoney-ifsc-le',         environment: 'PROD', serverIp: '10.40.40.23',     fqdn: 'indmoney-ifsc-le.linkedeye.local' },
  { name: 'Lemonn Mumbai',          slug: 'lemonn-mum-le',            environment: 'PROD', serverIp: '154.210.170.126',  fqdn: 'lemonn.finspot.in',            description: 'Lemonn Mumbai Production — 154.210.170.126' },
  { name: 'FinSpot DX',             slug: 'fs-dx-le',                 environment: 'PROD', serverIp: '206.1.32.216',    fqdn: 'fs-dx-le.linkedeye.local' },
  { name: 'Mirae Asset',            slug: 'fs-le-prod-mirae',         environment: 'PROD', serverIp: '192.168.152.156', fqdn: 'fs-le-prod-mirae.linkedeye.local' },
  { name: 'SMIFS',                  slug: 'fs-le-smifs',              environment: 'PROD', serverIp: null,              fqdn: 'fs-le-smifs.linkedeye.local' },
  { name: 'FinSpot UAT',            slug: 'fs-le-uat',                environment: 'UAT',  serverIp: '172.16.0.55',     fqdn: 'fs-le-uat.linkedeye.local' },
  { name: 'FinSpot DEV',            slug: 'fs-le-dev-finspot',        environment: 'DEV',  serverIp: '172.16.0.56',     fqdn: 'fs-le-dev-finspot.linkedeye.local' },
];

async function main() {
  console.log('Seeding 16 client organizations...\n');

  const password = await bcrypt.hash('LinkedEye@2026', 12);

  for (const org of ORGANIZATIONS) {
    const created = await prisma.organization.upsert({
      where: { slug: org.slug },
      update: { name: org.name, environment: org.environment, serverIp: org.serverIp, fqdn: org.fqdn, ...(org.description ? { description: org.description } : {}) },
      create: {
        name: org.name,
        slug: org.slug,
        environment: org.environment,
        serverIp: org.serverIp,
        fqdn: org.fqdn,
        description: org.description || `${org.name} — ${org.environment} environment`,
      },
    });
    console.log(`  ✓ ${created.name} (${created.slug}) — ${created.environment}`);

    // Create an admin user for each org (if not exists)
    const adminEmail = `admin@${org.slug.replace(/-le$/, '')}.linkedeye.local`;
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { organizationId: created.id },
      create: {
        email: adminEmail,
        password,
        firstName: 'Admin',
        lastName: org.name.split(' ')[0],
        role: 'ADMIN',
        status: 'ACTIVE',
        organizationId: created.id,
      },
    });
    console.log(`    → Admin: ${adminEmail}`);
  }

  // Also create a super admin (no org) if not exists
  await prisma.user.upsert({
    where: { email: 'superadmin@linkedeye.local' },
    update: {},
    create: {
      email: 'superadmin@linkedeye.local',
      password,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: null,
    },
  });
  console.log('\n  ✓ Super Admin: superadmin@linkedeye.local (no org — sees all)\n');

  // Assign existing users (if any have no org) to first org
  const existingUsers = await prisma.user.findMany({ where: { organizationId: null, email: { not: { contains: 'linkedeye.local' } } } });
  if (existingUsers.length > 0) {
    const firstOrg = await prisma.organization.findFirst({ where: { slug: 'fs-mum-indmoney-prod-le' } });
    if (firstOrg) {
      await prisma.user.updateMany({
        where: { id: { in: existingUsers.map(u => u.id) } },
        data: { organizationId: firstOrg.id },
      });
      console.log(`  → Assigned ${existingUsers.length} existing user(s) to ${firstOrg.name}\n`);
    }
  }

  console.log('Done! All organizations seeded.');
  console.log('Default password for all org admins: LinkedEye@2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
