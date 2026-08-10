// ═══════════════════════════════════════════════════════════
// WeCrew Ops ITSM — Public Site Routes
// Mounted at /api/v1/public — NO authentication.
//
// Only add routes here that are safe for an anonymous caller on the open
// internet. Anything that reads tenant data belongs on an authenticated router.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { createLead } = require('../controllers/public.controller');

// Far tighter than globalLimiter (100/min): a human fills in a contact form
// once, so anything beyond a handful per hour from one address is abuse.
// Keyed on the forwarded client address rather than req.ip, which behind nginx
// and the host Traefik would otherwise collapse every visitor onto one bucket.
const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null;
    return first || req.ip;
  },
  message: {
    success: false,
    error: 'Too many requests from this address. Please email us instead.',
  },
});

// Pilot / demo request from the public marketing site.
router.post('/leads', leadLimiter, createLead);

module.exports = router;
