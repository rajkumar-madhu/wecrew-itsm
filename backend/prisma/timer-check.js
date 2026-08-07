const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.incident.findFirst({
  where: { number: 'INC0000032' },
  select: { createdAt: true, lastEscalatedAt: true, escalationLevel: true, state: true }
}).then(i => {
  const elapsedMin = Math.round((Date.now() - new Date(i.createdAt)) / 60000);
  const l2In = Math.max(0, 15 - elapsedMin);
  console.log('state:', i.state, '| escalationLevel:', i.escalationLevel);
  console.log('createdAt:', i.createdAt);
  console.log('elapsed:', elapsedMin, 'min');
  console.log('L2 fires in:', l2In > 0 ? l2In + ' min' : 'NEXT CYCLE (< 60s)');
  console.log('lastEscalatedAt:', i.lastEscalatedAt);
}).catch(console.error).finally(() => p.$disconnect());
