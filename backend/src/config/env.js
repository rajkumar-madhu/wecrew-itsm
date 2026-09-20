// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Environment Configuration
// ═══════════════════════════════════════════════════════════

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[ENV] Missing required vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),

  db: { url: process.env.DATABASE_URL },
  redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' },

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  keycloak: {
    url: process.env.KEYCLOAK_URL,
    realm: process.env.KEYCLOAK_REALM,
    clientId: process.env.KEYCLOAK_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
  },

  observability: {
    prometheusUrl: process.env.PROMETHEUS_URL,
    lokiUrl: process.env.LOKI_URL,
    grafanaUrl: process.env.GRAFANA_URL,
    grafanaApiKey: process.env.GRAFANA_API_KEY,
  },

  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    defaultChannel: process.env.SLACK_DEFAULT_CHANNEL || '#incidents',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // Public self-registration creates an organization and makes the registrant
  // its (org-scoped) ADMIN. Off unless explicitly enabled: see the tenant
  // isolation audit before turning this on for the open internet.
  selfServiceSignup: process.env.SELF_SERVICE_SIGNUP === 'true',

  // Optional: not in REQUIRED, so environments without billing still boot.
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    starterPlanId: process.env.RAZORPAY_STARTER_PLAN_ID,
  },

  msg91: { apiKey: process.env.MSG91_API_KEY, senderId: process.env.MSG91_SENDER_ID },
  kaleyra: { apiKey: process.env.KALEYRA_API_KEY, senderId: process.env.KALEYRA_SENDER_ID },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    defaultChatId: process.env.TELEGRAM_CHAT_ID,
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@itsm.wecrew.in',
  },

  ai: {
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    hfTeiUrl: process.env.HF_TEI_URL,
    flowiseUrl: process.env.FLOWISE_URL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  },

  serviceNow: {
    instance: process.env.SNOW_INSTANCE,
    user: process.env.SNOW_USER,
    password: process.env.SNOW_PASSWORD,
  },

  voiceServer: process.env.VOICE_SERVER_URL || 'http://localhost:8100',
};

module.exports = { validateEnv, config };
