/**
 * Onboard Contabo EU — Organization + Admin User + Integrations + Teams
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

const ORG = {
  name: 'Contabo EU',
  slug: 'contabo-eu-le',
  environment: 'PROD',
  serverIp: '173.249.2.23',
  fqdn: 'contabo-eu.wecrew.in',
};

const SSH = {
  sshPort: 22,
  sshUser: 'admin',
  accessMethod: 'ssh',
};

const INTEGRATIONS = [
  {
    name: 'contabo-eu-prometheus',
    type: 'PROMETHEUS',
    config: JSON.stringify({
      ...SSH,
      promPort: 30000,
      prometheusUrl: `http://${ORG.serverIp}:30000`,
      serverIp: ORG.serverIp,
    }),
  },
  {
    name: 'contabo-eu-k8s',
    type: 'KUBERNETES_CLUSTER',
    config: JSON.stringify({
      ...SSH,
      serverIp: ORG.serverIp,
      clusterName: 'contabo-eu-k8s',
    }),
  },
  {
    name: 'contabo-eu-grafana',
    type: 'GRAFANA',
    config: JSON.stringify({
      ...SSH,
      grafanaPort: 30010,
      grafanaExternalUrl: `http://${ORG.serverIp}:30010`,
      serverIp: ORG.serverIp,
    }),
  },
];

const DEFAULT_TEAMS = [
  { name: 'NOC', description: 'Network Operations Center — 24/7 monitoring and triage' },
  { name: 'Infrastructure', description: 'Server, network, and cloud infrastructure management' },
  { name: 'DevOps', description: 'CI/CD pipelines, deployments, and platform automation' },
  { name: 'DBA', description: 'Database administration and performance tuning' },
  { name: 'App Support', description: 'Application-level support and troubleshooting' },
];

async function main() {
  // 1. Create Organization
  let org = await p.organization.findFirst({ where: { slug: ORG.slug } });
  if (org) {
    console.log('Org already exists:', org.name, org.id);
  } else {
    org = await p.organization.create({ data: ORG });
    console.log('Created org:', org.name, org.id);
  }

  // 2. Create Admin User
  const email = `admin@${ORG.slug}.linkedeye.local`;
  let user = await p.user.findFirst({ where: { email } });
  if (user) {
    console.log('User already exists:', user.email);
  } else {
    const hash = await bcrypt.hash('LinkedEye@2026', 12);
    user = await p.user.create({
      data: {
        email,
        password: hash,
        firstName: 'Admin',
        lastName: 'Contabo EU',
        role: 'ADMIN',
        status: 'ACTIVE',
        organizationId: org.id,
      },
    });
    console.log('Created user:', user.email, '(password: LinkedEye@2026)');
  }

  // 3. Create Integrations
  for (const integ of INTEGRATIONS) {
    const existing = await p.integration.findFirst({
      where: { name: integ.name, organizationId: org.id },
    });
    if (existing) {
      console.log('Integration exists:', integ.name);
      continue;
    }
    await p.integration.create({
      data: {
        name: integ.name,
        type: integ.type,
        config: integ.config,
        status: 'ACTIVE',
        organizationId: org.id,
      },
    });
    console.log('Created integration:', integ.name, '(' + integ.type + ')');
  }

  // 4. Create Default Teams
  for (const t of DEFAULT_TEAMS) {
    const existing = await p.team.findFirst({
      where: { name: t.name, organizationId: org.id },
    });
    if (existing) {
      console.log('Team exists:', t.name);
      continue;
    }
    await p.team.create({
      data: {
        name: t.name,
        description: t.description,
        managerId: user.id,
        organizationId: org.id,
      },
    });
    console.log('Created team:', t.name);
  }

  // 5. Create On-Call for the admin user (90 days)
  const teams = await p.team.findMany({ where: { organizationId: org.id }, select: { id: true, name: true } });
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 90);

  for (const team of teams) {
    await p.onCallSchedule.create({
      data: {
        teamId: team.id,
        userId: user.id,
        startTime: now,
        endTime: end,
        isPrimary: true,
      },
    });
  }
  console.log('Created on-call schedules:', teams.length, 'teams (90 days)');

  // Summary
  console.log('\n=== Contabo EU Onboarding Complete ===');
  console.log('Org ID:', org.id);
  console.log('Admin:', email, '/ LinkedEye@2026');
  console.log('Integrations:', INTEGRATIONS.length);
  console.log('Teams:', DEFAULT_TEAMS.length);
  console.log('Server:', ORG.serverIp + ':' + SSH.sshPort, '(user:', SSH.sshUser + ')');
  console.log('\nNext: Add SSH public key on Contabo server, then verify K8s/Prometheus/Grafana from Argus UI');

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
