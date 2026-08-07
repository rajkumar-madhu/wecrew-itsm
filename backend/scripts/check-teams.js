const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Which orgs have incidents without teams?
  const noTeamInc = await p.incident.findMany({
    where: { assignmentGroupId: null },
    select: { organizationId: true }
  });
  const orgCounts = {};
  noTeamInc.forEach(i => { const k = i.organizationId || 'NULL'; orgCounts[k] = (orgCounts[k] || 0) + 1; });

  const orgIds = Object.keys(orgCounts).filter(k => k !== 'NULL');
  const orgs = await p.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } });
  const orgMap = {};
  orgs.forEach(o => { orgMap[o.id] = o.name; });

  console.log('Orgs with unassigned incidents:');
  Object.entries(orgCounts).forEach(([id, count]) => {
    console.log('  ' + (orgMap[id] || id) + ': ' + count + ' incidents');
  });

  // Which orgs have teams already?
  const teamsPerOrg = await p.team.groupBy({ by: ['organizationId'], _count: true });
  console.log('\nOrgs with teams:');
  for (const t of teamsPerOrg) {
    const org = await p.organization.findUnique({ where: { id: t.organizationId }, select: { name: true } });
    console.log('  ' + (org ? org.name : t.organizationId) + ': ' + t._count + ' teams');
  }

  // All orgs
  const allOrgs = await p.organization.findMany({ select: { id: true, name: true } });
  const orgsWithTeams = new Set(teamsPerOrg.map(t => t.organizationId));
  console.log('\nOrgs WITHOUT teams:');
  allOrgs.filter(o => !orgsWithTeams.has(o.id)).forEach(o => console.log('  ' + o.name + ' (' + o.id.substring(0, 8) + ')'));

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
