// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Seed Team Members, Escalation Policies & On-Call Schedules
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const PASSWORD = bcrypt.hashSync('LinkedEye@2026', 12);

// ── Team Members ────────────────────────────────────────
const MEMBERS = [
  {
    email: 'rajkumar.madhu@rmadhu.in',
    firstName: 'Rajkumar',
    lastName: 'Madhu',
    phone: '9176772077',
    role: 'ENGINEER',
    jobTitle: 'Senior DevOps Engineer',
    department: 'DevOps',
    skills: ['Platform architecture', 'DevOps', 'Kubernetes', 'Docker', 'CI/CD'],
    teams: ['DevOps', 'Platform Engineering'],
    teamRole: 'LEAD',
    onCallPrimary: true,
    escalationLevel: 1,
  },
  {
    email: 'hoysala.bise@wecrew.in',
    firstName: 'Hoysala',
    lastName: 'Bise',
    phone: '9980146101',
    role: 'ENGINEER',
    jobTitle: 'DevOps Engineer',
    department: 'DevOps',
    skills: ['Incident response', 'Monitoring', 'Prometheus', 'Grafana', 'Escalation'],
    teams: ['DevOps'],
    teamRole: 'MEMBER',
    onCallPrimary: false,
    escalationLevel: 2,
  },
  {
    email: 'siva.kadirannagari@wecrew.in',
    firstName: 'Siva',
    lastName: 'Kadirannagari',
    phone: '9603683828',
    role: 'ENGINEER',
    jobTitle: 'Network Lead',
    department: 'Network Operations',
    skills: ['DNS', 'Firewall', 'VPN', 'Switches', 'DR DNS cutover'],
    teams: ['Network Operations'],
    teamRole: 'LEAD',
    onCallPrimary: true,
    escalationLevel: 1,
  },
  {
    email: 'rajkumar.ashokan@wecrew.in',
    firstName: 'Rajkumar',
    lastName: 'Ashokan',
    phone: '9751892775',
    role: 'ENGINEER',
    jobTitle: 'DBA',
    department: 'DBA',
    skills: ['MySQL', 'PostgreSQL', 'MongoDB', 'DR data sync', 'Backup & Recovery'],
    teams: ['DBA'],
    teamRole: 'LEAD',
    onCallPrimary: true,
    escalationLevel: 1,
  },
  {
    email: 'shrikant.pandit@wecrew.in',
    firstName: 'Shrikant',
    lastName: 'Pandit',
    phone: null,
    role: 'MANAGER',
    jobTitle: 'Client Relations Manager',
    department: 'Client Relations',
    skills: ['Client communication', 'Escalation management', 'SLA management'],
    teams: ['DevOps', 'Network Operations', 'DBA'],
    teamRole: 'OBSERVER',
    onCallPrimary: false,
    escalationLevel: 3, // Final escalation for all teams
  },
  {
    email: 'edukondalu.p@wecrew.in',
    firstName: 'Edukondalu',
    lastName: 'P',
    phone: '9840023898',
    role: 'ENGINEER',
    jobTitle: 'Network Engineer',
    department: 'Network Operations',
    skills: ['Routing', 'Network monitoring', 'BOD/EOD ops', 'SNMP'],
    teams: ['Network Operations'],
    teamRole: 'MEMBER',
    onCallPrimary: false,
    escalationLevel: 2,
  },
  {
    email: 'devendrareddy.puppala@wecrew.in',
    firstName: 'Devendrareddy',
    lastName: 'Puppala',
    phone: '6301462775',
    role: 'ENGINEER',
    jobTitle: 'Network Engineer',
    department: 'Network Operations',
    skills: ['SNMP monitoring', 'Network devices', 'Switch configuration'],
    teams: ['Network Operations'],
    teamRole: 'MEMBER',
    onCallPrimary: false,
    escalationLevel: 2,
  },
];

// ── Escalation Policies ─────────────────────────────────
const ESCALATION_POLICIES = {
  DevOps: {
    name: 'DevOps Incident Escalation',
    description: 'P1: 5min → Primary On-Call, P1: 15min → Senior DevOps, P1: 30min → Client Relations Manager',
    rules: [
      { level: 1, delayMinutes: 5, notifyType: 'ALL', targets: 'rajkumar.madhu@rmadhu.in' },
      { level: 2, delayMinutes: 15, notifyType: 'ALL', targets: 'hoysala.bise@wecrew.in' },
      { level: 3, delayMinutes: 30, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@wecrew.in' },
    ],
  },
  'Network Operations': {
    name: 'Network Incident Escalation',
    description: 'P1: 5min → Network Lead, P1: 15min → Network Engineers, P1: 30min → Client Relations Manager',
    rules: [
      { level: 1, delayMinutes: 5, notifyType: 'ALL', targets: 'siva.kadirannagari@wecrew.in' },
      { level: 2, delayMinutes: 15, notifyType: 'ALL', targets: 'edukondalu.p@wecrew.in,devendrareddy.puppala@wecrew.in' },
      { level: 3, delayMinutes: 30, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@wecrew.in' },
    ],
  },
  DBA: {
    name: 'DBA Incident Escalation',
    description: 'P1: 5min → DBA Lead, P1: 15min → Senior DevOps, P1: 30min → Client Relations Manager',
    rules: [
      { level: 1, delayMinutes: 5, notifyType: 'ALL', targets: 'rajkumar.ashokan@wecrew.in' },
      { level: 2, delayMinutes: 15, notifyType: 'ALL', targets: 'rajkumar.madhu@rmadhu.in' },
      { level: 3, delayMinutes: 30, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@wecrew.in' },
    ],
  },
  'Platform Engineering': {
    name: 'Platform Incident Escalation',
    description: 'P1: 5min → Platform Lead, P1: 15min → DevOps, P1: 30min → Client Relations Manager',
    rules: [
      { level: 1, delayMinutes: 5, notifyType: 'ALL', targets: 'rajkumar.madhu@rmadhu.in' },
      { level: 2, delayMinutes: 15, notifyType: 'ALL', targets: 'hoysala.bise@wecrew.in' },
      { level: 3, delayMinutes: 30, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@wecrew.in' },
    ],
  },
};

async function main() {
  console.log('═══ Seeding Team Members, Escalation Policies & Schedules ═══\n');

  // Get all teams
  const teams = await prisma.team.findMany();
  const teamMap = {};
  teams.forEach(t => { teamMap[t.name] = t; });

  // ── Create/Update Users ──────────────────────────────
  console.log('── Creating team members ──');
  const userMap = {};

  for (const m of MEMBERS) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {
        firstName: m.firstName,
        lastName: m.lastName,
        phone: m.phone,
        jobTitle: m.jobTitle,
        department: m.department,
        skills: m.skills,
      },
      create: {
        email: m.email,
        password: PASSWORD,
        firstName: m.firstName,
        lastName: m.lastName,
        phone: m.phone,
        role: m.role,
        jobTitle: m.jobTitle,
        department: m.department,
        skills: m.skills,
        timezone: 'Asia/Kolkata',
      },
    });

    userMap[m.email] = user;
    console.log(`  ✓ ${user.firstName} ${user.lastName} (${user.email}) — ${m.jobTitle}`);

    // Add to teams
    for (const teamName of m.teams) {
      const team = teamMap[teamName];
      if (!team) {
        console.log(`    ⚠ Team "${teamName}" not found, skipping`);
        continue;
      }

      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: user.id } },
        update: { role: m.teamRole },
        create: { teamId: team.id, userId: user.id, role: m.teamRole },
      });
      console.log(`    → Added to ${teamName} as ${m.teamRole}`);

      // Set as team manager if LEAD
      if (m.teamRole === 'LEAD' && !team.managerId) {
        await prisma.team.update({
          where: { id: team.id },
          data: { managerId: user.id },
        });
        console.log(`    → Set as manager of ${teamName}`);
      }
    }
  }

  // ── Create Escalation Policies ───────────────────────
  console.log('\n── Creating escalation policies ──');

  for (const [teamName, policy] of Object.entries(ESCALATION_POLICIES)) {
    const team = teamMap[teamName];
    if (!team) {
      console.log(`  ⚠ Team "${teamName}" not found, skipping policy`);
      continue;
    }

    // Delete existing policies for this team
    const existing = await prisma.escalationPolicy.findMany({ where: { teamId: team.id } });
    for (const ep of existing) {
      await prisma.escalationRule.deleteMany({ where: { policyId: ep.id } });
    }
    await prisma.escalationPolicy.deleteMany({ where: { teamId: team.id } });

    const ep = await prisma.escalationPolicy.create({
      data: {
        teamId: team.id,
        name: policy.name,
        description: policy.description,
        isActive: true,
      },
    });

    for (const rule of policy.rules) {
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

    console.log(`  ✓ ${policy.name} — ${policy.rules.length} levels`);
    policy.rules.forEach(r => {
      console.log(`    L${r.level}: ${r.delayMinutes}min → ${r.targets}`);
    });
  }

  // ── Create On-Call Schedules (weekly rotation) ───────
  console.log('\n── Creating on-call schedules ──');

  // Delete existing schedules
  await prisma.onCallSchedule.deleteMany();

  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  // On-call schedules per team
  const onCallConfig = {
    DevOps: [
      { email: 'rajkumar.madhu@rmadhu.in', primary: true },
      { email: 'hoysala.bise@wecrew.in', primary: false },
    ],
    'Network Operations': [
      { email: 'siva.kadirannagari@wecrew.in', primary: true },
      { email: 'edukondalu.p@wecrew.in', primary: false },
      { email: 'devendrareddy.puppala@wecrew.in', primary: false },
    ],
    DBA: [
      { email: 'rajkumar.ashokan@wecrew.in', primary: true },
    ],
    'Platform Engineering': [
      { email: 'rajkumar.madhu@rmadhu.in', primary: true },
    ],
  };

  for (const [teamName, schedules] of Object.entries(onCallConfig)) {
    const team = teamMap[teamName];
    if (!team) continue;

    for (let week = 0; week < 4; week++) {
      for (const sched of schedules) {
        const user = userMap[sched.email];
        if (!user) continue;

        const startTime = new Date(now.getTime() + week * weekMs);
        const endTime = new Date(startTime.getTime() + weekMs);

        await prisma.onCallSchedule.create({
          data: {
            teamId: team.id,
            userId: user.id,
            startTime,
            endTime,
            isPrimary: sched.primary,
          },
        });
      }
    }
    console.log(`  ✓ ${teamName} — ${schedules.length} on-call members, 4-week rotation`);
  }

  console.log('\n═══ Seeding complete ═══');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
