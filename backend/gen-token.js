const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const prisma = new PrismaClient();
prisma.user.findFirst({ where: { email: 'superadmin@linkedeye.local' }}).then(u => {
  const t = jwt.sign({ userId: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  process.stdout.write(t + '\n');
}).finally(() => prisma.$disconnect());
