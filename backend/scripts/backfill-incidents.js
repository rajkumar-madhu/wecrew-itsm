// Backfill incidents: set category, team, and assignee for existing incidents
const { PrismaClient } = require('@prisma/client');
const { classifyCategory, classifySubcategory } = require('../src/controllers/alert.controller');
const p = new PrismaClient();

const CATEGORY_TEAM_PATTERNS = {
  'Hardware': ['Infrastructure', 'Platform', 'SRE', 'Infra', 'NOC'],
  'Cloud Infrastructure': ['Infrastructure', 'Platform', 'SRE', 'Infra', 'NOC'],
  'Network': ['Network', 'NOC'],
  'Database': ['DBA', 'Database'],
  'Security': ['Security', 'SecOps'],
  'Application': ['Application', 'Development', 'Engineering', 'App Support'],
  'Monitoring': ['DevOps', 'Platform', 'NOC'],
  'Other': ['DevOps', 'Platform', 'NOC'],
};

async function main() {
  const incidents = await p.incident.findMany({
    where: {
      OR: [
        { category: null },
        { assignmentGroupId: null },
        { assignedToId: null },
      ]
    },
    select: { id: true, number: true, sourceAlertName: true, category: true, assignmentGroupId: true, assignedToId: true, organizationId: true }
  });
  console.log('Incidents to update:', incidents.length);

  let catUpdated = 0, teamUpdated = 0, assigneeUpdated = 0;

  for (const inc of incidents) {
    const updates = {};

    // 1. Category
    if (inc.category === null && inc.sourceAlertName) {
      const cat = classifyCategory(inc.sourceAlertName);
      const subcat = classifySubcategory(inc.sourceAlertName);
      if (cat) { updates.category = cat; catUpdated++; }
      if (subcat) updates.subcategory = subcat;
    }

    // 2. Team assignment
    if (inc.assignmentGroupId === null && inc.organizationId) {
      const category = updates.category || inc.category || 'Monitoring';
      const patterns = CATEGORY_TEAM_PATTERNS[category] || CATEGORY_TEAM_PATTERNS['Other'];
      for (const pat of patterns) {
        const team = await p.team.findFirst({
          where: { organizationId: inc.organizationId, name: { contains: pat, mode: 'insensitive' } },
          select: { id: true, managerId: true },
        });
        if (team) {
          updates.assignmentGroupId = team.id;
          if (inc.assignedToId === null && team.managerId) {
            updates.assignedToId = team.managerId;
            assigneeUpdated++;
          }
          teamUpdated++;
          break;
        }
      }
    }

    // 3. Assignee fallback from team manager
    if (inc.assignedToId === null && updates.assignedToId === undefined) {
      const teamId = updates.assignmentGroupId || inc.assignmentGroupId;
      if (teamId) {
        const team = await p.team.findUnique({ where: { id: teamId }, select: { managerId: true } });
        if (team && team.managerId) {
          updates.assignedToId = team.managerId;
          assigneeUpdated++;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await p.incident.update({ where: { id: inc.id }, data: updates });
    }
  }

  console.log('Categories updated:', catUpdated);
  console.log('Teams assigned:', teamUpdated);
  console.log('Assignees set:', assigneeUpdated);

  const nullCat = await p.incident.count({ where: { category: null } });
  const nullTeam = await p.incident.count({ where: { assignmentGroupId: null } });
  const nullAssignee = await p.incident.count({ where: { assignedToId: null } });
  console.log('\nRemaining NULL - Category:', nullCat, '| Team:', nullTeam, '| Assignee:', nullAssignee);

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
