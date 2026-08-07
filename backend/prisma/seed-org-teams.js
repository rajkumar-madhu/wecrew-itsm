// ═══════════════════════════════════════════════════════════
// Argus ITSM — Per-Org Team Seed
// For every organization, creates 5 teams (LE, DevOps, Network, DB, Management)
// scoped to that org's organizationId, and adds the Finspot global staff
// as members + sets up escalation policies and 4-week on-call schedules.
//
// Run: node prisma/seed-org-teams.js
// Run against K8s prod:
//   DATABASE_URL="postgresql://linkedeye:linkedeye@10.97.121.123:5432/linkedeye?schema=public" node prisma/seed-org-teams.js
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── Finspot staff emails (already seeded globally) ──────────
const STAFF = {
  // LE Team
  le: {
    lead: 'rajkumar.ashokan@finspot.in',   // LE App Engineer
  },
  // DevOps Team
  devops: {
    lead: 'rajkumar.madhu@rmadhu.in',      // Senior DevOps Lead
    members: ['hoysala.bise@finspot.in'],
  },
  // Network Team
  network: {
    lead: 'siva.kadirannagari@finspot.in', // Senior Network Lead
    members: ['edukondalu.p@finspot.in', 'devendrareddy.puppala@finspot.in'],
  },
  // DB Team (LE App Engineer covers DB too; DevOps lead on L2)
  db: {
    lead: 'rajkumar.ashokan@finspot.in',
    members: ['rajkumar.madhu@rmadhu.in'],
  },
  // Management / escalation final stop
  management: {
    lead: 'shrikant.pandit@finspot.in',
  },
};

// ── 5 teams to create per org ────────────────────────────────
const TEAM_DEFS = [
  { key: 'le',         name: 'LE Team',         description: 'LinkedEye application support and maintenance', email: 'le-team@finspot.in',     slackChannel: '#le-team'        },
  { key: 'devops',     name: 'DevOps Team',      description: 'DevOps, platform engineering, and K8s operations', email: 'devops@finspot.in', slackChannel: '#devops'          },
  { key: 'network',    name: 'Network Team',     description: 'Network devices, hardware, firewalls, and connectivity', email: 'network@finspot.in', slackChannel: '#network-ops'  },
  { key: 'db',         name: 'DB Team',          description: 'Database administration and recovery', email: 'dba@finspot.in',         slackChannel: '#dba'             },
  { key: 'management', name: 'Management Team',  description: 'Client relations and final escalation', email: 'management@finspot.in', slackChannel: '#management'     },
];

// ── Escalation policies per team (level → who) ──────────────
const ESCALATION_TEMPLATES = {
  le: {
    name: 'LE App Escalation',
    description: 'L1: LE App Engineer (5min) → L2: Senior DevOps Lead (15min) → L3: Management (30min)',
    rules: [
      { level: 1, delayMinutes: 5,  notifyType: 'ALL',          targets: 'rajkumar.ashokan@finspot.in' },
      { level: 2, delayMinutes: 15, notifyType: 'ALL',          targets: 'rajkumar.madhu@rmadhu.in' },
      { level: 3, delayMinutes: 30, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@finspot.in' },
    ],
  },
  devops: {
    name: 'DevOps Team Escalation',
    description: 'L1: Senior DevOps Lead (5min) → L2: DevOps Engineer (15min) → L3: Management (30min)',
    rules: [
      { level: 1, delayMinutes: 5,  notifyType: 'ALL',          targets: 'rajkumar.madhu@rmadhu.in' },
      { level: 2, delayMinutes: 15, notifyType: 'ALL',          targets: 'hoysala.bise@finspot.in' },
      { level: 3, delayMinutes: 30, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@finspot.in' },
    ],
  },
  network: {
    name: 'Network Incident Escalation',
    description: 'L1: Senior Network Lead (5min) → L2: Network Engineers (15min) → L3: Management (30min)',
    rules: [
      { level: 1, delayMinutes: 5,  notifyType: 'ALL',          targets: 'siva.kadirannagari@finspot.in' },
      { level: 2, delayMinutes: 15, notifyType: 'ALL',          targets: 'edukondalu.p@finspot.in,devendrareddy.puppala@finspot.in' },
      { level: 3, delayMinutes: 30, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@finspot.in' },
    ],
  },
  db: {
    name: 'DB Incident Escalation',
    description: 'L1: DB Lead (5min) → L2: Senior DevOps Lead (15min) → L3: Management (30min)',
    rules: [
      { level: 1, delayMinutes: 5,  notifyType: 'ALL',          targets: 'rajkumar.ashokan@finspot.in' },
      { level: 2, delayMinutes: 15, notifyType: 'ALL',          targets: 'rajkumar.madhu@rmadhu.in' },
      { level: 3, delayMinutes: 30, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@finspot.in' },
    ],
  },
  management: {
    name: 'Management Escalation',
    description: 'Client Relations Manager — final stop',
    rules: [
      { level: 1, delayMinutes: 0, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@finspot.in' },
    ],
  },
};

// ── On-call config per team (email + isPrimary) ──────────────
const ONCALL_TEMPLATES = {
  le:         [{ email: 'rajkumar.ashokan@finspot.in', primary: true }],
  devops:     [{ email: 'rajkumar.madhu@rmadhu.in', primary: true }, { email: 'hoysala.bise@finspot.in', primary: false }],
  network:    [{ email: 'siva.kadirannagari@finspot.in', primary: true }, { email: 'edukondalu.p@finspot.in', primary: false }, { email: 'devendrareddy.puppala@finspot.in', primary: false }],
  db:         [{ email: 'rajkumar.ashokan@finspot.in', primary: true }, { email: 'rajkumar.madhu@rmadhu.in', primary: false }],
  management: [{ email: 'shrikant.pandit@finspot.in', primary: true }],
};

// ── Member mapping per team key ──────────────────────────────
function getMemberEmails(key) {
  const s = STAFF[key];
  const all = [];
  if (s.lead) all.push({ email: s.lead, role: 'LEAD' });
  if (s.members) s.members.forEach(e => all.push({ email: e, role: 'MEMBER' }));
  return all;
}

async function main() {
  console.log('═══ Seeding Per-Org Teams ═══\n');

  // ── Load all orgs ────────────────────────────────────────
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
  console.log(`Found ${orgs.length} organizations\n`);

  // ── Load all Finspot staff users ─────────────────────────
  const allEmails = new Set([
    ...Object.values(STAFF).flatMap(s => [s.lead, ...(s.members || [])].filter(Boolean)),
  ]);
  const staffUsers = await prisma.user.findMany({
    where: { email: { in: [...allEmails] } },
    select: { id: true, email: true },
  });
  const userByEmail = {};
  staffUsers.forEach(u => { userByEmail[u.email] = u; });

  const missing = [...allEmails].filter(e => !userByEmail[e]);
  if (missing.length > 0) {
    console.warn('⚠ Missing users (run seed-finspot-teams.js first):', missing.join(', '));
    console.warn('  Continuing — those members will be skipped.\n');
  }

  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  let teamsCreated = 0;
  let membersAssigned = 0;
  let policiesCreated = 0;
  let schedulesCreated = 0;

  for (const org of orgs) {
    console.log(`\n── ${org.name} (${org.slug}) ──`);

    for (const def of TEAM_DEFS) {
      // ── Create/update team scoped to this org ────────────
      let team = await prisma.team.findFirst({
        where: { name: def.name, organizationId: org.id },
      });

      if (team) {
        team = await prisma.team.update({
          where: { id: team.id },
          data: { description: def.description, email: def.email, slackChannel: def.slackChannel },
        });
      } else {
        team = await prisma.team.create({
          data: {
            name: def.name,
            description: def.description,
            email: def.email,
            slackChannel: def.slackChannel,
            organizationId: org.id,
          },
        });
        teamsCreated++;
      }

      // ── Assign members ───────────────────────────────────
      const memberDefs = getMemberEmails(def.key);
      for (const m of memberDefs) {
        const user = userByEmail[m.email];
        if (!user) continue;

        await prisma.teamMember.upsert({
          where: { teamId_userId: { teamId: team.id, userId: user.id } },
          update: { role: m.role },
          create: { teamId: team.id, userId: user.id, role: m.role },
        });
        membersAssigned++;

        // Set LEAD as team manager
        if (m.role === 'LEAD') {
          await prisma.team.update({ where: { id: team.id }, data: { managerId: user.id } });
        }
      }

      // ── Escalation policy ────────────────────────────────
      const policyTemplate = ESCALATION_TEMPLATES[def.key];
      if (policyTemplate) {
        // Remove old policy
        const existing = await prisma.escalationPolicy.findMany({ where: { teamId: team.id } });
        for (const ep of existing) {
          await prisma.escalationRule.deleteMany({ where: { policyId: ep.id } });
        }
        await prisma.escalationPolicy.deleteMany({ where: { teamId: team.id } });

        const ep = await prisma.escalationPolicy.create({
          data: {
            teamId: team.id,
            name: policyTemplate.name,
            description: policyTemplate.description,
            isActive: true,
          },
        });
        for (const rule of policyTemplate.rules) {
          await prisma.escalationRule.create({
            data: {
              policyId: ep.id,
              level: rule.level,
              delayMinutes: rule.delayMinutes,
              notifyType: rule.notifyType,
              notifyTargets: rule.targets,
            },
          });
        }
        policiesCreated++;
      }

      // ── On-call schedules (4-week rotation) ─────────────
      await prisma.onCallSchedule.deleteMany({ where: { teamId: team.id } });

      const onCallDefs = ONCALL_TEMPLATES[def.key] || [];
      for (let week = 0; week < 4; week++) {
        for (const oc of onCallDefs) {
          const user = userByEmail[oc.email];
          if (!user) continue;
          await prisma.onCallSchedule.create({
            data: {
              teamId: team.id,
              userId: user.id,
              startTime: new Date(now.getTime() + week * weekMs),
              endTime: new Date(now.getTime() + (week + 1) * weekMs),
              isPrimary: oc.primary,
            },
          });
          schedulesCreated++;
        }
      }

      console.log(`  ✓ ${def.name} — ${memberDefs.length} members`);
    }
  }

  console.log('\n═══ Complete ═══');
  console.log(`  Organizations : ${orgs.length}`);
  console.log(`  Teams created : ${teamsCreated}`);
  console.log(`  Members       : ${membersAssigned}`);
  console.log(`  Escalations   : ${policiesCreated}`);
  console.log(`  OnCall slots  : ${schedulesCreated}`);
  console.log('\nAlert routing:');
  console.log('  Network / Hardware / Security  → Network Team (Siva, Edukondalu, Devendrareddy)');
  console.log('  Application / Infrastructure   → DevOps Team  (Rajkumar Madhu, Hoysala)');
  console.log('  Database                       → DB Team      (Rajkumar Ashokan)');
  console.log('  LE Application                 → LE Team      (Rajkumar Ashokan)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
