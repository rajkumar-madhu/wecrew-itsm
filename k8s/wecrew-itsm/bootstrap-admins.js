// One-time bootstrap for the FRESH wecrew-itsm database (README step 4).
// Recreates the WeCrew organization and the two ADMIN accounts that existed in itsm-wecrew,
// each with a new random password printed exactly once. Refuses to run if any user exists.
// Passwords are hashed with bcryptjs, 12 rounds — the same as auth.controller.js.
// Run it from an operator shell, never commit the output:
//
//   kubectl -n wecrew-itsm exec -i deploy/linkedeye-api -- node - < k8s/wecrew-itsm/bootstrap-admins.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const newPassword = () => crypto.randomBytes(14).toString('base64url').slice(0, 18) + 'K7!';

(async () => {
  if (await prisma.user.count()) {
    console.log('ABORT: users already exist — this bootstrap is for an empty database only');
    return;
  }
  const org = await prisma.organization.create({ data: { name: 'WeCrew', slug: 'wecrew', environment: 'PROD' } });
  // Cross-org access needs BOTH role === 'ADMIN' and isPlatformAdmin === true —
  // see isPlatformAdmin() in backend/src/middleware/tenant.js. A plain ADMIN with
  // organizationId: null resolves to NO_TENANT ({ organizationId: { in: [] } })
  // and sees nothing at all, which is what "all orgs" used to produce here.
  const admins = [
    { email: 'admin@wecrew.in', firstName: 'WeCrew', lastName: 'Admin', organizationId: org.id, isPlatformAdmin: false },
    { email: 'rajkumarmadhu2024@gmail.com', firstName: 'rajkumar', lastName: 'madhu', organizationId: null, isPlatformAdmin: true },
  ];
  const out = [];
  for (const a of admins) {
    const password = newPassword();
    const user = await prisma.user.create({
      data: { ...a, password: await bcrypt.hash(password, 12), role: 'ADMIN', status: 'ACTIVE', passwordChangedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { action: 'USER_BOOTSTRAPPED', entityType: 'User', entityId: user.id,
        newData: { email: user.email, role: 'ADMIN', reason: 'wecrew-itsm fresh database bootstrap' } },
    });
    out.push({
      email: user.email,
      scope: a.isPlatformAdmin ? 'all orgs (platform admin)' : 'WeCrew org',
      password,
    });
  }
  console.log(JSON.stringify({ organization: org.slug, admins: out }, null, 1));
})()
  .catch((e) => { console.error('FAILED:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
