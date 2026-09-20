// ═══════════════════════════════════════════════════════════
// Argus ITSM — Seed Finspot Real Teams
// Updates 6 real users and groups them into 4 teams:
//   LE Team, DevOps Team, Network Team, Management Team
//
// Run: node prisma/seed-finspot-teams.js
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const PASSWORD = bcrypt.hashSync('Wecrew@2026', 12);

// ── Real people from the Finspot/WeCrew team ──────────────
const PEOPLE = [
  {
    email: 'rajkumar.madhu@rmadhu.in',
    firstName: 'Rajkumar',
    lastName: 'Madhu',
    phone: '9176772077',
    role: 'ENGINEER',
    jobTitle: 'Senior DevOps Lead',
    department: 'DevOps',
    skills: ['Kubernetes', 'Docker', 'CI/CD', 'Platform Architecture', 'Terraform'],
    team: 'DevOps Team',
    teamRole: 'LEAD',
  },
  {
    email: 'hoysala.bise@wecrew.in',
    firstName: 'Hoysala',
    lastName: 'Bise',
    phone: '9980146101',
    role: 'ENGINEER',
    jobTitle: 'DevOps Engineer',
    department: 'DevOps',
    skills: ['Prometheus', 'Grafana', 'Monitoring', 'Incident Response', 'Escalation'],
    team: 'DevOps Team',
    teamRole: 'MEMBER',
  },
  {
    email: 'siva.kadirannagari@wecrew.in',
    firstName: 'Siva',
    lastName: 'Kadirannagari',
    phone: '9603683828',
    role: 'ENGINEER',
    jobTitle: 'Senior Network Lead',
    department: 'Network Operations',
    skills: ['DNS', 'Firewall', 'VPN', 'Switches', 'DR DNS Cutover', 'BGP'],
    team: 'Network Team',
    teamRole: 'LEAD',
  },
  {
    email: 'rajkumar.ashokan@wecrew.in',
    firstName: 'Rajkumar',
    lastName: 'Ashokan',
    phone: '9751892775',
    role: 'ENGINEER',
    jobTitle: 'LE App Engineer',
    department: 'LE Application',
    skills: ['WeCrew', 'Application Support', 'MySQL', 'PostgreSQL', 'DR Data Sync'],
    team: 'LE Team',
    teamRole: 'MEMBER',
  },
  {
    email: 'edukondalu.p@wecrew.in',
    firstName: 'Edukondalu',
    lastName: 'P',
    phone: '9840023898',
    role: 'ENGINEER',
    jobTitle: 'Network Engineer',
    department: 'Network Operations',
    skills: ['Routing', 'Network Monitoring', 'BOD/EOD Ops', 'SNMP'],
    team: 'Network Team',
    teamRole: 'MEMBER',
  },
  {
    email: 'devendrareddy.puppala@wecrew.in',
    firstName: 'Devendrareddy',
    lastName: 'Puppala',
    phone: '6301462775',
    role: 'ENGINEER',
    jobTitle: 'Network Engineer',
    department: 'Network Operations',
    skills: ['SNMP Monitoring', 'Network Devices', 'Switch Configuration'],
    team: 'Network Team',
    teamRole: 'MEMBER',
  },
  // Management — Client Relations
  {
    email: 'shrikant.pandit@wecrew.in',
    firstName: 'Shrikant',
    lastName: 'Pandit',
    phone: null,
    role: 'MANAGER',
    jobTitle: 'Client Relations Manager',
    department: 'Management',
    skills: ['Client Communication', 'SLA Management', 'Escalation Management'],
    team: 'Management Team',
    teamRole: 'LEAD',
  },
];

// ── 4 Teams ─────────────────────────────────────────────────
const TEAMS = [
  {
    name: 'LE Team',
    description: 'WeCrew application support and maintenance team',
    email: 'support@wecrew.in',
    slackChannel: '#le-team',
  },
  {
    name: 'DevOps Team',
    description: 'DevOps and platform engineering team',
    email: 'support@wecrew.in',
    slackChannel: '#devops',
  },
  {
    name: 'Network Team',
    description: 'Network operations, DNS, firewall, and infrastructure connectivity',
    email: 'support@wecrew.in',
    slackChannel: '#network-ops',
  },
  {
    name: 'Management Team',
    description: 'Client relations and escalation management',
    email: 'support@wecrew.in',
    slackChannel: '#management',
  },
];

async function main() {
  console.log('═══ Seeding Finspot Real Teams ═══\n');

  // ── Step 1: Create/upsert the 4 teams ───────────────────
  console.log('── Creating teams ──');
  const teamMap = {};

  for (const t of TEAMS) {
    let team = await prisma.team.findFirst({
      where: { name: t.name, organizationId: null },
    });
    if (team) {
      team = await prisma.team.update({
        where: { id: team.id },
        data: { description: t.description, email: t.email, slackChannel: t.slackChannel },
      });
    } else {
      team = await prisma.team.create({
        data: { name: t.name, description: t.description, email: t.email, slackChannel: t.slackChannel },
      });
    }
    teamMap[t.name] = team;
    console.log(`  ✓ Team: ${team.name} (${team.id})`);
  }

  // ── Step 2: Create/update the 7 people ──────────────────
  console.log('\n── Creating/updating users ──');
  const userMap = {};

  for (const p of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        jobTitle: p.jobTitle,
        department: p.department,
        skills: p.skills,
        role: p.role,
      },
      create: {
        email: p.email,
        password: PASSWORD,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        role: p.role,
        jobTitle: p.jobTitle,
        department: p.department,
        skills: p.skills,
        timezone: 'Asia/Kolkata',
      },
    });
    userMap[p.email] = user;
    console.log(`  ✓ ${user.firstName} ${user.lastName} — ${p.jobTitle}`);
  }

  // ── Step 3: Assign members to teams ─────────────────────
  console.log('\n── Assigning team memberships ──');

  for (const p of PEOPLE) {
    const team = teamMap[p.team];
    const user = userMap[p.email];
    if (!team || !user) continue;

    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      update: { role: p.teamRole },
      create: { teamId: team.id, userId: user.id, role: p.teamRole },
    });
    console.log(`  ✓ ${user.firstName} ${user.lastName} → ${team.name} (${p.teamRole})`);

    // Set LEAD as team manager
    if (p.teamRole === 'LEAD') {
      await prisma.team.update({
        where: { id: team.id },
        data: { managerId: user.id },
      });
    }
  }

  // ── Step 4: On-call schedules (4-week rotation) ──────────
  console.log('\n── Creating on-call schedules ──');

  // Clear existing schedules for these 4 teams
  const teamIds = Object.values(teamMap).map(t => t.id);
  await prisma.onCallSchedule.deleteMany({ where: { teamId: { in: teamIds } } });

  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const onCallConfig = {
    'LE Team': [
      { email: 'rajkumar.ashokan@wecrew.in', primary: true },
    ],
    'DevOps Team': [
      { email: 'rajkumar.madhu@rmadhu.in', primary: true },
      { email: 'hoysala.bise@wecrew.in', primary: false },
    ],
    'Network Team': [
      { email: 'siva.kadirannagari@wecrew.in', primary: true },
      { email: 'edukondalu.p@wecrew.in', primary: false },
      { email: 'devendrareddy.puppala@wecrew.in', primary: false },
    ],
    'Management Team': [
      { email: 'shrikant.pandit@wecrew.in', primary: true },
    ],
  };

  for (const [teamName, schedules] of Object.entries(onCallConfig)) {
    const team = teamMap[teamName];
    if (!team) continue;

    for (let week = 0; week < 4; week++) {
      for (const sched of schedules) {
        const user = userMap[sched.email];
        if (!user) continue;

        await prisma.onCallSchedule.create({
          data: {
            teamId: team.id,
            userId: user.id,
            startTime: new Date(now.getTime() + week * weekMs),
            endTime: new Date(now.getTime() + (week + 1) * weekMs),
            isPrimary: sched.primary,
          },
        });
      }
    }
    console.log(`  ✓ ${teamName} — ${schedules.length} on-call member(s), 4-week rotation`);
  }

  // ── Step 5: Escalation policies ─────────────────────────
  console.log('\n── Creating escalation policies ──');

  const escalationPolicies = {
    'DevOps Team': {
      name: 'DevOps Team Escalation',
      description: 'L1: Rajkumar Madhu (5min) → L2: Hoysala Bise (15min) → L3: Management (30min)',
      rules: [
        { level: 1, delayMinutes: 5, notifyType: 'ALL', targets: 'rajkumar.madhu@rmadhu.in' },
        { level: 2, delayMinutes: 15, notifyType: 'ALL', targets: 'hoysala.bise@wecrew.in' },
        { level: 3, delayMinutes: 30, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@wecrew.in' },
      ],
    },
    'Network Team': {
      name: 'Network Incident Escalation',
      description: 'L1: Siva (5min) → L2: Edukondalu + Devendrareddy (15min) → L3: Management (30min)',
      rules: [
        { level: 1, delayMinutes: 5, notifyType: 'ALL', targets: 'siva.kadirannagari@wecrew.in' },
        { level: 2, delayMinutes: 15, notifyType: 'ALL', targets: 'edukondalu.p@wecrew.in,devendrareddy.puppala@wecrew.in' },
        { level: 3, delayMinutes: 30, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@wecrew.in' },
      ],
    },
    'LE Team': {
      name: 'LE App Escalation',
      description: 'L1: Rajkumar Ashokan (5min) → L2: DevOps Team (15min) → L3: Management (30min)',
      rules: [
        { level: 1, delayMinutes: 5, notifyType: 'ALL', targets: 'rajkumar.ashokan@wecrew.in' },
        { level: 2, delayMinutes: 15, notifyType: 'ALL', targets: 'rajkumar.madhu@rmadhu.in' },
        { level: 3, delayMinutes: 30, notifyType: 'EMAIL_NOTIFY', targets: 'shrikant.pandit@wecrew.in' },
      ],
    },
  };

  for (const [teamName, policy] of Object.entries(escalationPolicies)) {
    const team = teamMap[teamName];
    if (!team) continue;

    // Remove old policies first
    const existing = await prisma.escalationPolicy.findMany({ where: { teamId: team.id } });
    for (const ep of existing) {
      await prisma.escalationRule.deleteMany({ where: { policyId: ep.id } });
    }
    await prisma.escalationPolicy.deleteMany({ where: { teamId: team.id } });

    const ep = await prisma.escalationPolicy.create({
      data: { teamId: team.id, name: policy.name, description: policy.description, isActive: true },
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

    console.log(`  ✓ ${policy.name} — ${policy.rules.length} escalation levels`);
  }

  console.log('\n═══ Done ═══');
  console.log('\nTeam Summary:');
  console.log('  LE Team        → Rajkumar Ashokan');
  console.log('  DevOps Team    → Rajkumar Madhu (Senior DevOps Lead), Hoysala Bise');
  console.log('  Network Team   → Siva Kadirannagari (Lead), Edukondalu P, Devendrareddy Puppala');
  console.log('  Management Team → Shrikant Pandit');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
