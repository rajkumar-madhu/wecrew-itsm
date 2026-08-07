// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Prisma Database Client (Singleton)
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');

// Increase connection pool to 15 — default (~3) saturates on parallel dashboard queries
const baseUrl = process.env.DATABASE_URL || '';
const dbUrl = baseUrl.includes('connection_limit')
  ? baseUrl
  : baseUrl.includes('?')
    ? `${baseUrl}&connection_limit=15&pool_timeout=10`
    : `${baseUrl}?connection_limit=15&pool_timeout=10`;

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'production'
      ? ['warn', 'error']
      : ['query', 'info', 'warn', 'error'],
  datasources: {
    db: { url: dbUrl },
  },
});

prisma.$on('query', (e) => {
  if (process.env.NODE_ENV !== 'production' && e.duration > 500) {
    console.warn(`Slow query (${e.duration}ms): ${e.query}`);
  }
});

async function connectDB() {
  let retries = 5;
  while (retries > 0) {
    try {
      await prisma.$connect();
      console.log('[DB] PostgreSQL connected (pool: 15)');
      return;
    } catch (err) {
      retries -= 1;
      console.error(`[DB] Connection failed, retries left: ${retries}`, err.message);
      if (retries === 0) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function disconnectDB() {
  await prisma.$disconnect();
  console.log('[DB] PostgreSQL disconnected');
}

module.exports = { prisma, connectDB, disconnectDB };
