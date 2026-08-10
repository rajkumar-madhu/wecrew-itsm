// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM Platform — Backend Server
// © 2026 Santhira (Terv Pro Technology Pvt Ltd)
// ═══════════════════════════════════════════════════════════

const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const { validateEnv, config } = require('./config/env');
const { connectDB, disconnectDB } = require('./config/database');
const { initSocket } = require('./config/socket');
const { morganMiddleware } = require('./utils/logger');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');
const { tenantContext } = require('./middleware/tenant');
const { checkSLACompliance } = require('./services/slaService');
const { processEmailQueue, sendAllOrgAlertDigests } = require('./services/emailService');
const { syncRemoteAlerts } = require('./services/alertSyncService');
const { checkEscalations } = require('./services/escalationService');

// Routes
const authRoutes = require('./routes/auth.routes');
const incidentRoutes = require('./routes/incident.routes');
const changeRoutes = require('./routes/change.routes');
const problemRoutes = require('./routes/problem.routes');
const alertRoutes = require('./routes/alert.routes');
const assetRoutes = require('./routes/asset.routes');
const teamRoutes = require('./routes/team.routes');
const notificationRoutes = require('./routes/notification.routes');
const integrationRoutes = require('./routes/integration.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const searchRoutes = require('./routes/search.routes');
const webhookRoutes = require('./routes/webhook.routes');
const reportRoutes = require('./routes/report.routes');
const smsRoutes = require('./routes/sms.routes');
const voiceRoutes = require('./routes/voice.routes');
const aiRoutes = require('./routes/ai.routes');
const aiAgentRoutes = require('./routes/aiAgent.routes');
const organizationRoutes = require('./routes/organization.routes');
const k8sRoutes = require('./routes/k8s.routes');
const agentPipelineRoutes = require('./routes/agentPipeline.routes');
const pagerdutyRoutes = require('./routes/pagerduty.routes');
const apmRoutes = require('./routes/apm.routes');
const statusRoutes = require('./routes/status.routes');
const auditRoutes = require('./routes/audit.routes');
const chatRoutes = require('./routes/chat.routes');
const publicRoutes = require('./routes/public.routes');

// ── Validate Environment ────────────────────────────────
validateEnv();

const app = express();
const server = http.createServer(app);

// ── Trust proxy (behind nginx/k8s ingress) ──────────────
app.set('trust proxy', 1);

// ── Middleware Stack ────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      // Allow Grafana panel iframes from any org's Grafana instance
      frameSrc: ["'self'", "https:", "http:"],
    },
  },
}));
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morganMiddleware);
app.use(globalLimiter);

// Static uploads
app.use('/uploads', express.static('uploads'));

// Serve dashboard UI from public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Health Check ────────────────────────────────────────

app.get('/health', async (_req, res) => {
  try {
    const { prisma } = require('./config/database');
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      service: 'linkedeye-api',
      version: '2.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// ── API Routes ──────────────────────────────────────────

// Tenant context is applied per-route via authenticate + tenantContext middleware
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/incidents', incidentRoutes);
app.use('/api/v1/changes', changeRoutes);
app.use('/api/v1/problems', problemRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/sms', smsRoutes);
app.use('/api/v1/voice', voiceRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/ai', aiAgentRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/k8s', k8sRoutes);
app.use('/api/v1/agent', agentPipelineRoutes);
app.use('/api/v1/pagerduty', pagerdutyRoutes);
app.use('/api/v1/apm', apmRoutes);
app.use('/api/v1/status', statusRoutes);  // Public — no auth
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/public', publicRoutes);  // Public — no auth (marketing site forms)

// ── 404 ─────────────────────────────────────────────────

app.use((req, res) => {
  // API routes get JSON 404; everything else gets the dashboard SPA
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Error Handler ───────────────────────────────────────

app.use(errorHandler);

// ── Start Server ────────────────────────────────────────

async function start() {
  try {
    await connectDB();
    logger.info('[DB] PostgreSQL connected');

    // Socket.IO
    initSocket(server, config.corsOrigins);
    logger.info('[WS] Socket.IO initialized');

    // Fix SSH key permissions (K8s secrets mount as 0777 symlinks, SSH requires 0600)
    try {
      const fs = require('fs');
      const sshSrc = '/home/finadmin/.ssh/id_ed25519';
      const sshDst = '/tmp/.ssh_id_ed25519';
      if (fs.existsSync(sshSrc)) {
        fs.copyFileSync(sshSrc, sshDst);
        fs.chmodSync(sshDst, 0o600);
        logger.info('[SSH] Key copied to %s with 0600 permissions', sshDst);
      }
    } catch (sshErr) {
      logger.warn('[SSH] Failed to fix key permissions: %s', sshErr.message);
    }

    // SLA check cron (every 60s)
    setInterval(checkSLACompliance, 60 * 1000);
    logger.info('[SLA] SLA compliance checker started');

    // Email queue processor (every 5min)
    setInterval(processEmailQueue, 5 * 60 * 1000);
    logger.info('[EMAIL] Email queue processor started');

    // Alert digest emailer — all orgs with firing alerts (every 15min)
    // Sends one consolidated email per org to all ADMIN/MANAGER users
    const ALERT_DIGEST_INTERVAL = 15 * 60 * 1000;
    setInterval(sendAllOrgAlertDigests, ALERT_DIGEST_INTERVAL);
    setTimeout(sendAllOrgAlertDigests, 90 * 1000);   // first run 90s after boot
    logger.info('[AlertDigest] Org alert digest cron started (15min interval)');

    // Pull-based alert sync from remote Prometheus (every 2 minutes)
    // Solves: remote orgs can't push webhooks to Argus (DNS/NAT/firewall)
    setInterval(syncRemoteAlerts, 2 * 60 * 1000);
    // Run once 30s after boot to catch any firing alerts immediately
    setTimeout(syncRemoteAlerts, 30 * 1000);
    logger.info('[AlertSync] Remote alert sync started (2min interval)');

    // On-Call auto-escalation engine (every 60s)
    setInterval(checkEscalations, 60 * 1000);
    setTimeout(checkEscalations, 45 * 1000); // First run 45s after boot
    logger.info('[Escalation] On-call auto-escalation engine started (60s interval)');

    // Stale alert auto-expiry (every 6 hours)
    // Resolves INFO alerts older than 3 days and WARNING older than 7 days
    setInterval(async () => {
      try {
        const now = new Date();
        const [infoExpired, warnExpired] = await Promise.all([
          prisma.alert.updateMany({
            where: { status: 'FIRING', severity: 'INFO', firedAt: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
            data: { status: 'RESOLVED', resolvedAt: now },
          }),
          prisma.alert.updateMany({
            where: { status: 'FIRING', severity: 'WARNING', firedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            data: { status: 'RESOLVED', resolvedAt: now },
          }),
        ]);
        const total = infoExpired.count + warnExpired.count;
        if (total > 0) logger.info(`[AlertExpiry] Auto-resolved ${total} stale alerts (${infoExpired.count} INFO, ${warnExpired.count} WARNING)`);
      } catch (err) {
        logger.warn('[AlertExpiry] Cleanup failed: %s', err.message);
      }
    }, 6 * 60 * 60 * 1000);
    logger.info('[AlertExpiry] Stale alert auto-expiry started (6h interval)');

    server.listen(config.port, () => {
      logger.info(`═══════════════════════════════════════`);
      logger.info(`  LinkedEye ITSM API Server v2.0.0`);
      logger.info(`  Environment: ${config.nodeEnv}`);
      logger.info(`  Port: ${config.port}`);
      logger.info(`  URL: http://localhost:${config.port}`);
      logger.info(`═══════════════════════════════════════`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

// ── Graceful Shutdown ───────────────────────────────────

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    await disconnectDB();
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();

module.exports = app;
