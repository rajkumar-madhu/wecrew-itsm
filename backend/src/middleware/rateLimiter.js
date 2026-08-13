// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Rate Limiters
// ═══════════════════════════════════════════════════════════

const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, slow down' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts, try again later' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { success: false, error: 'API rate limit exceeded' },
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { success: false, error: 'Webhook rate limit exceeded' },
});

module.exports = { globalLimiter, authLimiter, apiLimiter, webhookLimiter };
