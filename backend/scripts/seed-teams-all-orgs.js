// Create default teams for orgs that don't have any
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const DEFAULT_TEAMS = ['NOC', 'Infrastructure', 'DevOps', 'DBA', 'App Support'];

async function main() {
  // Get orgs without teams
  const allOrgs = await p.organization.findMany({ select: { id: true, name: true, slug: true } });
  const existingTeamOrgs = await p.team.groupBy({ by: ['organizationId'] });
  const orgsWithTeams = new Set(existingTeamOrgs.map(t => t.organizationId));

  const orgsNeeding = allOrgs.filter(o => !orgsWithTeams.has(o.id));
  console.log('Creating teams for', orgsNeeding.length, 'orgs');

  // Get a default manager (first admin or any active user)
  const defaultManager = await p.user.findFirst({
    where: { role: 'ADMIN', status: 'ACTIVE', organizationId: null },
    select: { id: true, email: true }
  });
  console.log('Default manager:', defaultManager ? defaultManager.email : 'none');

  let created = 0;
  for (const org of orgsNeeding) {
    // Check if org has any users that could be managers
    const orgUser = await p.user.findFirst({
      where: { organizationId: org.id, status: 'ACTIVE' },
      select: { id: true },
      orderBy: { createdAt: 'asc' }
    });
    const managerId = orgUser ? orgUser.id : (defaultManager ? defaultManager.id : null);

    for (const teamName of DEFAULT_TEAMS) {
      const fullName = org.slug ? `${org.name} ${teamName}` : teamName;
      await p.team.create({
        data: {
          name: fullName,
          description: `${teamName} team for ${org.name}`,
          organizationId: org.id,
          managerId: managerId,
        }
      });
      created++;
    }
    console.log('  Created 5 teams for', org.name);
  }

  console.log('Total teams created:', created);
  console.log('Total teams now:', await p.team.count());
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
