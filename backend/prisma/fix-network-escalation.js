// Fix Network Team escalation chain across all orgs:
// L1 (30min): rajkumar.madhu@finspot.in + devendrareddy.puppala@finspot.in
// L2 (60min): edukondalu.p@finspot.in
// L3 (360min): siva.kadirannagari@finspot.in
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Get all Network Team escalation policies
  const policies = await p.escalationPolicy.findMany({
    where: { team: { name: 'Network Team' }, isActive: true },
    include: { rules: { orderBy: { level: 'asc' } }, team: { select: { name: true, organizationId: true } } }
  });

  console.log('Network Team policies found:', policies.length);
  let updated = 0;

  for (const pol of policies) {
    for (const rule of pol.rules) {
      let newTargets = null;
      if (rule.level === 1) newTargets = 'rajkumar.madhu@finspot.in,devendrareddy.puppala@finspot.in';
      if (rule.level === 2) newTargets = 'edukondalu.p@finspot.in';
      if (rule.level === 3) newTargets = 'siva.kadirannagari@finspot.in';
      if (newTargets) {
        await p.escalationRule.update({ where: { id: rule.id }, data: { notifyTargets: newTargets } });
        updated++;
      }
    }
  }

  console.log('Rules updated:', updated);

  // Verify one policy
  const sample = await p.escalationPolicy.findFirst({
    where: { team: { name: 'Network Team' }, isActive: true },
    include: { rules: { orderBy: { level: 'asc' } } }
  });
  console.log('\nNetwork Team chain (all orgs):');
  sample.rules.forEach(r => console.log('  L' + r.level + ' (' + r.delayMinutes + 'min): ' + r.notifyTargets));

  // ── Create test network incident for escalation test ──────────────────────
  // Find Network Team for Lemonn org
  const LEMONN_ORG = '78b981f8-4df8-4c74-8a59-c9ea3fd8be6c';
  const networkTeam = await p.team.findFirst({ where: { name: 'Network Team', organizationId: LEMONN_ORG } });

  // Set incident createdAt 29 min ago → L1 fires in next 60s cycle
  const twentyNineMinsAgo = new Date(Date.now() - 29 * 60 * 1000);

  // Check if test incident already exists
  const adminUser = await p.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });

  let testInc = await p.incident.findFirst({ where: { number: 'INC-NET-TEST-001', organizationId: LEMONN_ORG } });
  if (testInc) {
    await p.incident.update({
      where: { id: testInc.id },
      data: { state: 'NEW', escalationLevel: 0, lastEscalatedAt: null, createdAt: twentyNineMinsAgo, assignmentGroupId: networkTeam.id }
    });
    console.log('\nReset existing test incident:', testInc.number);
  } else {
    // Get next globally unique incident number
    const count = await p.incident.count();
    const num = 'INC' + String(count + 100).padStart(7, '0');
    testInc = await p.incident.create({
      data: {
        number: num,
        shortDescription: 'Network switch down — lemonn-mum-core-ns (10.41.0.5) — port flap detected',
        description: 'Prometheus alert: NodeNetworkInterfaceFlapping on lemonn-mum-core-ns. Interface eth0 went down at 14:00 UTC. Affects 3 downstream servers. ICMP to 10.41.0.5 timing out.',
        priority: 'P1',
        state: 'NEW',
        category: 'Network',
        impact: 'DEPARTMENT',
        urgency: 'CRITICAL',
        source: 'PROMETHEUS',
        escalationLevel: 0,
        createdAt: twentyNineMinsAgo,
        organizationId: LEMONN_ORG,
        assignmentGroupId: networkTeam.id,
        createdById: adminUser.id,
      }
    });
    console.log('\nCreated test incident:', testInc.number);
  }

  console.log('createdAt: 29 min ago → L1 fires in next 60s escalation cycle');
  console.log('L1 targets: rajkumar.madhu@finspot.in + devendrareddy.puppala@finspot.in');
}

main().catch(console.error).finally(() => p.$disconnect());
