const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 1. Update Rajkumar Madhu's phone
  const raj = await p.user.findFirst({ where: { email: 'rajkumar.madhu@finspot.in' } });
  if (!raj) { console.log('Rajkumar not found'); return; }

  await p.user.update({ where: { id: raj.id }, data: { phone: '+919176772077' } });
  console.log('Updated Rajkumar phone: +919176772077');

  // 2. Delete all on-call schedules NOT for Rajkumar Madhu
  const deleted = await p.onCallSchedule.deleteMany({ where: { userId: { not: raj.id } } });
  console.log('Deleted', deleted.count, 'non-Rajkumar on-call schedules');

  // 3. Delete expired schedules for Rajkumar too
  const now = new Date();
  const expiredDel = await p.onCallSchedule.deleteMany({ where: { userId: raj.id, endTime: { lt: now } } });
  console.log('Deleted', expiredDel.count, 'expired Rajkumar schedules');

  // 4. Check remaining
  const remaining = await p.onCallSchedule.findMany({
    where: { userId: raj.id },
    include: { team: { select: { name: true } } },
    orderBy: { startTime: 'asc' },
  });
  console.log('\nRemaining schedules:', remaining.length);
  remaining.forEach(s => console.log(' -', s.team?.name, '| primary:', s.isPrimary, '| to:', s.endTime.toISOString().slice(0, 10)));

  // 5. Get all teams, create 90-day on-call for Rajkumar as primary on each
  const allTeams = await p.team.findMany({ select: { id: true, name: true } });
  const end = new Date(now);
  end.setDate(end.getDate() + 90);

  // Remove all remaining (stale) and recreate fresh
  await p.onCallSchedule.deleteMany({ where: { userId: raj.id } });

  let created = 0;
  for (const team of allTeams) {
    await p.onCallSchedule.create({
      data: {
        teamId: team.id,
        userId: raj.id,
        startTime: now,
        endTime: end,
        isPrimary: true,
      },
    });
    created++;
  }
  console.log('\nCreated', created, 'on-call schedules for Rajkumar (90 days, primary) across all teams');

  // Final count
  const final = await p.onCallSchedule.count();
  console.log('Total on-call schedules:', final);

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
