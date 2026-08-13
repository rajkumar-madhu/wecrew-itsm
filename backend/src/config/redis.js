// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Redis Client
// ═══════════════════════════════════════════════════════════

const Redis = require('ioredis');

let redis = null;

function getRedis() {
  if (redis) return redis;

  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    keyPrefix: 'linkedeye:',
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    },
    reconnectOnError(err) {
      return err.message.includes('READONLY');
    },
  });

  redis.on('connect', () => console.log('[Redis] Connected'));
  redis.on('error', (err) => console.error('[Redis] Error:', err.message));

  return redis;
}

async function getJSON(key) {
  const data = await getRedis().get(key);
  return data ? JSON.parse(data) : null;
}

async function setJSON(key, value, ttlSeconds = 60) {
  await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

async function del(key) {
  await getRedis().del(key);
}

async function deletePattern(pattern) {
  const stream = getRedis().scanStream({ match: `linkedeye:${pattern}`, count: 100 });
  const pipeline = getRedis().pipeline();
  for await (const keys of stream) {
    for (const key of keys) {
      pipeline.del(key.replace('linkedeye:', ''));
    }
  }
  await pipeline.exec();
}

function cacheMiddleware(keyPrefix, ttlSeconds = 30) {
  return async (req, res, next) => {
    // Include org context in key so each org gets its own cached response
    const orgSegment = req.headers['x-organization-id'] || req.query.orgId || 'all';
    const key = `${keyPrefix}:${orgSegment}:${req.originalUrl}`;
    try {
      const cached = await getJSON(key);
      if (cached) {
        return res.json(cached);
      }
    } catch (_) { /* cache miss — continue */ }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        setJSON(key, body, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { getRedis, getJSON, setJSON, del, deletePattern, cacheMiddleware };
