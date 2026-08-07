// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Voice Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { paginate, paginationMeta, success, error, generateIncidentNumber } = require('../utils/helpers');
const { getCreateOrgId } = require('../middleware/tenant');
const voiceService = require('../services/voiceService');
const logger = require('../utils/logger');

// POST /api/v1/voice/transcribe — Audio → Text
async function transcribe(req, res, next) {
  try {
    if (!req.file) return error(res, 'Audio file is required', 400);

    const { language } = req.body;
    const result = await voiceService.transcribe(req.file.buffer, {
      language: language || 'en',
      format: req.file.mimetype?.split('/')?.[1] || 'wav',
    });

    return success(res, result);
  } catch (err) { next(err); }
}

// POST /api/v1/voice/synthesize — Text → Audio
async function synthesize(req, res, next) {
  try {
    const { text, language, voice, format } = req.body;
    if (!text) return error(res, 'text is required', 400);

    const result = await voiceService.synthesize(text, { language, voice, format });

    res.set('Content-Type', result.contentType);
    res.set('X-Language', result.language);
    return res.send(result.audio);
  } catch (err) { next(err); }
}

// POST /api/v1/voice/chat — Audio → LLM → Audio
async function voiceChat(req, res, next) {
  try {
    if (!req.file) return error(res, 'Audio file is required', 400);

    const { language, sessionId, context } = req.body;
    const result = await voiceService.voiceChat(req.file.buffer, {
      language: language || 'en',
      sessionId,
      context: context ? JSON.parse(context) : undefined,
    });

    res.set('Content-Type', result.contentType);
    res.set('X-Transcript', encodeURIComponent(result.transcript));
    res.set('X-Response-Text', encodeURIComponent(result.responseText));
    res.set('X-Language', result.language);
    return res.send(result.audio);
  } catch (err) { next(err); }
}

// ── Phone number normalization (India E.164) ────────────
function normalizePhone(raw) {
  if (!raw) return raw;
  let phone = raw.replace(/[\s\-\(\)]/g, ''); // strip spaces, dashes, parens
  // Already E.164
  if (/^\+\d{10,15}$/.test(phone)) return phone;
  // Indian number without country code (10 digits)
  if (/^\d{10}$/.test(phone)) return `+91${phone}`;
  // Indian number with 91 prefix but no +
  if (/^91\d{10}$/.test(phone)) return `+${phone}`;
  // Indian number with 0 prefix (trunk)
  if (/^0\d{10}$/.test(phone)) return `+91${phone.slice(1)}`;
  return phone; // return as-is for international numbers
}

// POST /api/v1/voice/call — Initiate outbound call
async function makeCall(req, res, next) {
  try {
    const { to, twiml, record, incidentId } = req.body;
    if (!to) return error(res, 'to (phone number) is required', 400);

    const normalizedTo = normalizePhone(to);
    if (!normalizedTo || normalizedTo.length < 10) return error(res, 'Invalid phone number format', 400);

    const statusCallback = `${process.env.PUBLIC_URL || 'https://fs-le-dev-inc.finspot.in'}/api/v1/webhooks/twilio/status`;

    // Look up caller name from phone number
    const cleanPhone = normalizedTo.replace('+91', '').replace('+', '').replace(/\s/g, '');
    const callerUser = await prisma.user.findFirst({
      where: { phone: { contains: cleanPhone } },
      select: { firstName: true, lastName: true },
    });
    const callerName = callerUser ? `${callerUser.firstName}${callerUser.lastName ? ' ' + callerUser.lastName : ''}` : null;

    // Resolve call language from request body or caller preferences
    const requestLang = req.body.language || null;
    const lang = requestLang || await voiceService.resolveCallLanguage(incidentId || null, req.organizationId || null, normalizedTo);

    // If incidentId provided, fetch incident + org details for rich TwiML
    let richTwiml = twiml;
    let incidentOrgId = null;
    if (!twiml && incidentId) {
      const incident = await prisma.incident.findUnique({
        where: { id: incidentId },
        include: {
          organization: { select: { name: true, slug: true, environment: true, preferredLanguage: true } },
          assignedTo: { select: { firstName: true, lastName: true } },
          assignmentGroup: { select: { name: true } },
        },
      });
      logger.info(`Voice call: incident=${incident?.number}, org=${incident?.organization?.name || 'none'}, priority=${incident?.priority}, caller=${callerName || 'unknown'}, lang=${lang}`);
      if (incident) {
        const incLang = requestLang || incident.organization?.preferredLanguage || lang;
        richTwiml = voiceService.buildIncidentTwiml(incident, callerName, incLang);
        incidentOrgId = incident.organizationId;
        logger.info(`Voice TwiML length: ${richTwiml.length} chars`);
      }
    }

    // If still no TwiML and user has org context, build org-aware greeting
    if (!richTwiml && req.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: req.organizationId },
        select: { name: true, slug: true, environment: true, preferredLanguage: true },
      });
      if (org) {
        richTwiml = voiceService.buildOrgGreetingTwiml(org, org.preferredLanguage || lang);
      }
    }

    const resolvedOrgId = incidentOrgId || req.organizationId;
    const result = await voiceService.makeCall(normalizedTo, { twiml: richTwiml, record, statusCallback, linkedIncidentId: incidentId || null, organizationId: resolvedOrgId });

    return success(res, result, 201);
  } catch (err) { next(err); }
}

// GET /api/v1/voice/calls — Call logs
async function getCallLogs(req, res, next) {
  try {
    const { direction, handler, status } = req.query;
    const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);

    const tw = req.tenantWhere || {};
    const where = { ...tw };
    if (direction) where.direction = direction;
    if (handler) where.handler = handler;
    if (status) where.status = status;

    const [calls, total] = await prisma.$transaction([
      prisma.voiceCallLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.voiceCallLog.count({ where }),
    ]);

    return success(res, calls, 200, paginationMeta(total, page, limit));
  } catch (err) { next(err); }
}

// GET /api/v1/voice/calls/:id
async function getCallLog(req, res, next) {
  try {
    const call = await prisma.voiceCallLog.findUnique({ where: { id: req.params.id } });
    if (!call) return error(res, 'Call log not found', 404);
    // Tenant access check
    const tw = req.tenantWhere || {};
    if (tw.organizationId && call.organizationId !== tw.organizationId) {
      return error(res, 'Call log not found', 404);
    }
    return success(res, call);
  } catch (err) { next(err); }
}

// GET /api/v1/voice/stats
async function getVoiceStats(req, res, next) {
  try {
    const tw = req.tenantWhere || {};
    const [total, inbound, outbound, aiHandled] = await prisma.$transaction([
      prisma.voiceCallLog.count({ where: { ...tw } }),
      prisma.voiceCallLog.count({ where: { ...tw, direction: 'INBOUND' } }),
      prisma.voiceCallLog.count({ where: { ...tw, direction: 'OUTBOUND' } }),
      prisma.voiceCallLog.count({ where: { ...tw, handler: 'AI_BOT' } }),
    ]);

    const avgDuration = await prisma.voiceCallLog.aggregate({
      _avg: { duration: true },
      where: { ...tw, duration: { not: null } },
    });

    return success(res, {
      total,
      inbound,
      outbound,
      aiHandled,
      averageDurationSeconds: Math.round(avgDuration._avg.duration || 0),
    });
  } catch (err) { next(err); }
}

// GET /api/v1/voice/languages
async function getSupportedLanguages(req, res) {
  return success(res, voiceService.getSupportedLanguages());
}

// GET /api/v1/voice/health
async function getHealth(req, res) {
  const health = await voiceService.healthCheck();
  return success(res, health);
}

// ── Twilio Voice Webhooks (no auth — Twilio verification) ──

// POST /api/v1/webhooks/twilio/voice (inbound call)
async function twilioInboundVoice(req, res, next) {
  try {
    const twiml = await voiceService.handleInboundCall(req.body);
    res.set('Content-Type', 'text/xml');
    return res.send(twiml);
  } catch (err) {
    logger.error(`Inbound voice webhook error: ${err.message}`);
    res.set('Content-Type', 'text/xml');
    return res.send(voiceService.buildErrorTwiml('en', 'errorGeneral'));
  }
}

// POST /api/v1/webhooks/twilio/speech (speech input)
async function twilioSpeechInput(req, res, next) {
  try {
    const twiml = await voiceService.handleSpeechInput(req.body);

    // Auto-create incident from speech
    const { SpeechResult, Confidence, From, CallSid } = req.body;
    if (parseFloat(Confidence) > 0.6 && SpeechResult) {
      const number = await generateIncidentNumber();
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      const incident = await prisma.incident.create({
        data: {
          number,
          shortDescription: SpeechResult.substring(0, 200),
          description: `Auto-created from voice call (${From}): ${SpeechResult}`,
          source: 'VOICE',
          createdById: admin?.id,
        },
      });

      // Update call log with linked incident
      await prisma.voiceCallLog.updateMany({
        where: { callSid: CallSid },
        data: { linkedIncidentId: incident.id, sentiment: 'neutral' },
      });

      logger.info(`Incident ${incident.number} auto-created from voice call ${CallSid}`);
    }

    res.set('Content-Type', 'text/xml');
    return res.send(twiml);
  } catch (err) {
    logger.error(`Speech webhook error: ${err.message}`);
    res.set('Content-Type', 'text/xml');
    return res.send(voiceService.buildErrorTwiml('en', 'errorSpeech'));
  }
}

// POST /api/v1/webhooks/twilio/gather (DTMF input)
async function twilioGather(req, res, next) {
  try {
    const twiml = await voiceService.handleGather(req.body);
    res.set('Content-Type', 'text/xml');
    return res.send(twiml);
  } catch (err) {
    logger.error(`Gather webhook error: ${err.message}`);
    // Always return valid TwiML to Twilio — never let errors bubble to Express JSON handler
    res.set('Content-Type', 'text/xml');
    return res.send(voiceService.buildErrorTwiml('en', 'errorGather'));
  }
}

// POST /api/v1/webhooks/twilio/status (call status callback)
async function twilioCallStatus(req, res, next) {
  try {
    await voiceService.handleCallStatusUpdate(req.body);
    return success(res, { received: true });
  } catch (err) { next(err); }
}

module.exports = {
  transcribe,
  synthesize,
  voiceChat,
  makeCall,
  getCallLogs,
  getCallLog,
  getVoiceStats,
  getSupportedLanguages,
  getHealth,
  twilioInboundVoice,
  twilioSpeechInput,
  twilioGather,
  twilioCallStatus,
};
