// ═══════════════════════════════════════════════════════════
// Argus ITSM — Legacy Team Cleanup
//
// Problem: 88 old per-org teams (Lemonn NOC, App Support, DevOps, etc.)
// all show Rajkumar Madhu as primary on-call, polluting the dashboard.
// The 5 standard teams per org (LE/DevOps/Network/DB/Management)
// already have correct schedules.
//
// Fix:
//   1. Remove on-call schedules from all legacy teams
//   2. Fix manager assignments by team type keyword
//   3. Delete the 3 empty global CloudOps-* teams
//
// Run: DATABASE_URL="postgresql://linkedeye:linkedeye@10.97.121.123:5432/linkedeye?schema=public" node prisma/cleanup-legacy-teams.js
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Standard 5 team names — these are kept as-is
const STANDARD_TEAMS = new Set(['LE Team', 'DevOps Team', 'Network Team', 'DB Team', 'Management Team']);

// Manager assignment by team name keyword (priority order)
const MANAGER_KEYWORDS = [
  { keywords: ['network', 'noc', 'security', 'infra'],   email: 'siva.kadirannagari@finspot.in' },
  { keywords: ['dba', 'database', 'db'],                  email: 'rajkumar.ashokan@finspot.in' },
  { keywords: ['app support', 'application', 'le '],      email: 'rajkumar.ashokan@finspot.in' },
  { keywords: ['devops', 'platform', 'engineering', 'cloudops'], email: 'rajkumar.madhu@rmadhu.in' },
  { keywords: ['management', 'client'],                   email: 'shrikant.pandit@finspot.in' },
];

// Global teams to delete entirely (no org, no members, no purpose)
const DELETE_GLOBAL_TEAMS = ['CloudOps-DevOps', 'CloudOps-Platform', 'CloudOps-SRE'];

async function resolveManager(teamName, staffByEmail) {
  const lower = teamName.toLowerCase();
  for (const rule of MANAGER_KEYWORDS) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return staffByEmail[rule.email]?.id || null;
    }
  }
  return staffByEmail['rajkumar.madhu@rmadhu.in']?.id || null; // fallback: DevOps lead
}

async function main() {
  console.log('═══ Legacy Team Cleanup ═══\n');

  // ── Load Finspot staff users ─────────────────────────────
  const allEmails = [
    'rajkumar.madhu@rmadhu.in',
    'hoysala.bise@finspot.in',
    'siva.kadirannagari@finspot.in',
    'rajkumar.ashokan@finspot.in',
    'edukondalu.p@finspot.in',
    'devendrareddy.puppala@finspot.in',
    'shrikant.pandit@finspot.in',
  ];
  const staffUsers = await prisma.user.findMany({
    where: { email: { in: allEmails } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  const staffByEmail = {};
  staffUsers.forEach(u => { staffByEmail[u.email] = u; });
  console.log(`Loaded ${staffUsers.length} Finspot staff users\n`);

  // ── Step 1: Delete empty global CloudOps-* teams ─────────
  console.log('── Removing empty global teams ──');
  for (const name of DELETE_GLOBAL_TEAMS) {
    const team = await prisma.team.findFirst({ where: { name, organizationId: null } });
    if (!team) { console.log(`  ⚠ ${name} not found`); continue; }
    await prisma.onCallSchedule.deleteMany({ where: { teamId: team.id } });
    const eps = await prisma.escalationPolicy.findMany({ where: { teamId: team.id } });
    for (const ep of eps) await prisma.escalationRule.deleteMany({ where: { policyId: ep.id } });
    await prisma.escalationPolicy.deleteMany({ where: { teamId: team.id } });
    await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
    // Only delete if no incidents assigned to it
    const incCount = await prisma.incident.count({ where: { assignmentGroupId: team.id } });
    if (incCount === 0) {
      await prisma.team.delete({ where: { id: team.id } });
      console.log(`  ✓ Deleted ${name}`);
    } else {
      console.log(`  ⚠ ${name} has ${incCount} incidents — clearing schedules only`);
    }
  }

  // ── Step 2: Fix all legacy teams ─────────────────────────
  console.log('\n── Fixing legacy teams ──');

  const legacyTeams = await prisma.team.findMany({
    where: { name: { notIn: [...STANDARD_TEAMS] } },
    select: { id: true, name: true, organizationId: true },
  });

  let schedulesCleared = 0;
  let managersFixed = 0;

  for (const team of legacyTeams) {
    // Clear all current on-call schedules (standard teams per-org already cover this)
    const deleted = await prisma.onCallSchedule.deleteMany({ where: { teamId: team.id } });
    schedulesCleared += deleted.count;

    // Fix manager based on team name keywords
    const managerId = await resolveManager(team.name, staffByEmail);
    if (managerId) {
      await prisma.team.update({ where: { id: team.id }, data: { managerId } });
      managersFixed++;
    }
  }

  console.log(`  ✓ Cleared on-call schedules from ${legacyTeams.length} legacy teams (${schedulesCleared} slots removed)`);
  console.log(`  ✓ Fixed managers on ${managersFixed} teams`);

  // ── Step 3: Verify standard teams still have correct on-call ─
  console.log('\n── Verifying standard team on-call schedules ──');
  const now = new Date();
  const standardTeams = await prisma.team.findMany({
    where: { name: { in: [...STANDARD_TEAMS] } },
    select: {
      name: true,
      organizationId: true,
      organization: { select: { slug: true } },
      onCallSchedules: {
        where: { startTime: { lte: now }, endTime: { gte: now }, isPrimary: true },
        select: { user: { select: { firstName: true, lastName: true } } },
        take: 1,
      },
    },
    orderBy: [{ name: 'asc' }, { organizationId: 'asc' }],
  });

  // Show a sample (global + first org)
  const sample = standardTeams.filter(t => !t.organizationId || t.organization?.slug === 'lemonn-mum-le');
  sample.forEach(t => {
    const scope = t.organizationId ? t.organization?.slug : 'GLOBAL';
    const oncall = t.onCallSchedules[0]?.user
      ? `${t.onCallSchedules[0].user.firstName} ${t.onCallSchedules[0].user.lastName}`
      : 'NONE';
    console.log(`  ${t.name.padEnd(18)} [${scope.padEnd(20)}] → ${oncall}`);
  });

  console.log('\n═══ Done ═══');
  console.log(`  Legacy teams processed : ${legacyTeams.length}`);
  console.log(`  On-call slots cleared  : ${schedulesCleared}`);
  console.log(`  Managers corrected     : ${managersFixed}`);
  console.log('\nOn-call dashboard will now only show the 5 standard teams per org.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
