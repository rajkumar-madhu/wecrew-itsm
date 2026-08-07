// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Voice Service (FastAPI Proxy + Twilio Voice)
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const FormData = require('form-data');
const { prisma } = require('../config/database');
const { config } = require('../config/env');
const logger = require('../utils/logger');
const { generateIncidentNumber, calculatePriority, calculateSLATargetTimes } = require('../utils/helpers');
const { dispatchEvent } = require('./webhookDispatcher');

// Lazy-load to avoid circular dep: eventEmitter → notificationService → voiceService → eventEmitter
let _eventBus;
function getEventBus() { if (!_eventBus) _eventBus = require('./eventEmitter'); return _eventBus; }

const VOICE_SERVER = config.voiceServer || process.env.VOICE_SERVER_URL || 'http://localhost:8100';
const PUBLIC_BASE = config.frontendUrl || process.env.PUBLIC_URL || 'https://fs-le-dev-inc.finspot.in';
const WEBHOOK_GATHER = `${PUBLIC_BASE}/api/v1/webhooks/twilio/gather`;
const WEBHOOK_SPEECH = `${PUBLIC_BASE}/api/v1/webhooks/twilio/speech`;

// ── Multi-Language Configuration ─────────────────────────
// Amazon Polly Aditi supports all Indian languages; the language attr controls phoneme rules

const LANGUAGE_CONFIG = {
  en: { voice: 'Polly.Aditi', language: 'en-IN', name: 'English' },
  hi: { voice: 'Polly.Aditi', language: 'hi-IN', name: 'Hindi' },
  ta: { voice: 'Polly.Aditi', language: 'ta-IN', name: 'Tamil' },
  te: { voice: 'Polly.Aditi', language: 'te-IN', name: 'Telugu' },
  ml: { voice: 'Polly.Aditi', language: 'ml-IN', name: 'Malayalam' },
  kn: { voice: 'Polly.Aditi', language: 'kn-IN', name: 'Kannada' },
  mr: { voice: 'Polly.Aditi', language: 'mr-IN', name: 'Marathi' },
  bn: { voice: 'Polly.Aditi', language: 'bn-IN', name: 'Bengali' },
  gu: { voice: 'Polly.Aditi', language: 'gu-IN', name: 'Gujarati' },
};

function getLangConfig(langCode) {
  return LANGUAGE_CONFIG[langCode] || LANGUAGE_CONFIG.en;
}

function sayTag(text, langCode) {
  const cfg = getLangConfig(langCode);
  return `<Say voice="${cfg.voice}" language="${cfg.language}">${text}</Say>`;
}

// ── Translated Message Templates ─────────────────────────

const MESSAGE_TEMPLATES = {
  en: {
    greeting: 'Hi %s.',
    teamIntro: 'This is Argus ITSM team calling regarding a %s issue for %s.',
    dtmfPrompt: 'Press 1 to acknowledge. Press 2 to escalate to Next Level.',
    noResponse: 'No response received. This incident will be auto-escalated.',
    closing: 'Thank you %s. For any queries, please reach out to the Argus ITSM team at le@finspot.in or raise a ticket on Argus. Have a good %s.',
    acknowledged: '%s has been acknowledged and moved to In Progress.',
    escalated: '%s has been escalated to Priority 1 Critical. The on-call manager has been notified.',
    welcome: 'Welcome to Argus IT Service Management%s. How can I help you today?',
    errorGeneral: 'We are experiencing a temporary issue. Please try again later or contact support. Thank you.',
    errorSpeech: 'We encountered an issue processing your input. Please try again. Thank you.',
    errorGather: 'We encountered a system error while processing your input. Your response has been logged. Our team will follow up shortly. Thank you.',
    invalidOption: 'Invalid option. Please try again.',
    orgGreeting: 'Hello, this is Argus ITSM for %s%s. You have a notification. Press 1 to acknowledge, or press 2 to escalate.',
    orgNoResponse: 'No response received. Goodbye.',
    defaultGreeting: 'Hello, this is Argus ITSM. You have a notification. Press 1 to acknowledge, or press 2 to escalate.',
    speechConfirm: 'Thank you. I\'ve noted your issue: %s. An incident will be created and assigned to our team. You will receive an SMS update shortly.',
    speechFail: 'I\'m sorry, I couldn\'t understand that clearly. Let me transfer you to an agent.',
    describeIssue: 'Please describe your issue after the beep.',
    noAudio: 'I didn\'t hear anything. Goodbye.',
    criticalAlert: 'Argus Critical Alert for %s. Incident %s. Priority %s. Host: %s.%s Issue: %s. Please acknowledge or escalate immediately.',
    escalatingNow: 'Escalating to Next Level now. Please hold.',
    ackRecorded: 'Your acknowledgement has been recorded in the system.',
  },
  hi: {
    greeting: 'Namaste %s.',
    teamIntro: 'Yeh Argus ITSM team hai, %s ke liye %s sambandhit issue ke baare mein call kar rahe hain.',
    dtmfPrompt: 'Acknowledge karne ke liye 1 dabayen. Escalate karne ke liye 2 dabayen.',
    noResponse: 'Koi response nahi mila. Yeh incident auto-escalate hoga.',
    closing: 'Dhanyavaad %s. Kisi bhi query ke liye Argus ITSM team se le@finspot.in par sampark karein. Shubh %s.',
    acknowledged: '%s acknowledge ho gaya hai aur In Progress mein move ho gaya hai.',
    escalated: '%s Priority 1 Critical par escalate ho gaya hai. On-call manager ko notify kiya gaya hai.',
    errorGeneral: 'Hum ek technical samasya ka anubhav kar rahe hain. Kripya baad mein dobara prayaas karein. Dhanyavaad.',
    errorSpeech: 'Aapka input process karne mein samasya aayi. Kripya dobara prayaas karein. Dhanyavaad.',
    errorGather: 'Aapka input process karne mein system error aaya hai. Humari team jald follow up karegi. Dhanyavaad.',
    invalidOption: 'Galat option. Kripya dobara prayaas karein.',
  },
  ta: {
    greeting: 'Vanakkam %s.',
    teamIntro: 'Idhu Argus ITSM team, %s-ku %s thodarbaana issue patriya azhaikkirom.',
    dtmfPrompt: 'Acknowledge seiya 1 azhuthavum. Escalate seiya 2 azhuthavum.',
    noResponse: 'Pathil varavillai. Idhu auto-escalate aagum.',
    closing: 'Nandri %s. Ethavadhu doubt irunthaal Argus ITSM team-ai le@finspot.in-il thodarbu kollungal. Nalla %s.',
    acknowledged: '%s acknowledge aagi In Progress-ku maari vittathu.',
    escalated: '%s Priority 1 Critical-ku escalate aagi vittathu. On-call manager-ku theriyappaduthappattathu.',
    errorGeneral: 'Oru tharkaalika prachanaiyai ethir kondu irukkiraom. Thayavu seithu pinnar mupayarchiyungal. Nandri.',
    invalidOption: 'Thavaaraan option. Thayavu seithu meeendum mupayarchiyungal.',
  },
  te: {
    greeting: 'Namaskaram %s.',
    teamIntro: 'Idi Argus ITSM team, %s kosam %s sambandhinchina issue gurinchi call chestunnamu.',
    dtmfPrompt: 'Acknowledge cheyaniki 1 noppandi. Escalate cheyaniki 2 noppandi.',
    noResponse: 'Response raledu. Ee incident auto-escalate avutundi.',
    closing: 'Dhanyavaadalu %s. Queries unte Argus ITSM team ni le@finspot.in lo contact cheyandi. Shubha %s.',
    acknowledged: '%s acknowledge aindi mariyu In Progress ki move aindi.',
    escalated: '%s Priority 1 Critical ki escalate aindi. On-call manager ki notify chesamu.',
    errorGeneral: 'Memu oka temporary samasyanu face chestunnamu. Dayachesi later try cheyandi. Dhanyavaadalu.',
    invalidOption: 'Tappudu option. Dayachesi malli try cheyandi.',
  },
  ml: {
    greeting: 'Namaskaaram %s.',
    teamIntro: 'Ithu Argus ITSM team aanu, %s-nte %s sambandhamaaya issue-ne kurichu vilikkunnu.',
    dtmfPrompt: 'Acknowledge cheyyaan 1 amarthuka. Escalate cheyyaan 2 amarthuka.',
    noResponse: 'Maruppadi onnum labhichilla. Ee incident auto-escalate cheyyum.',
    closing: 'Nanni %s. Enthenkilum samsayam undenkil Argus ITSM team-nte le@finspot.in-il bandhappeduka. Shubha %s.',
    acknowledged: '%s acknowledge aayi In Progress-ilekku maarunnu.',
    escalated: '%s Priority 1 Critical-ilekku escalate aayi. On-call manager-ne ariyichu.',
    errorGeneral: 'Njangal oru thaalkaalika prasnam neridukayaanu. Dayavayi pinned shramikkuka. Nanni.',
    invalidOption: 'Thettaaya option. Dayavayi veendum shramikkuka.',
  },
  kn: {
    greeting: 'Namaskara %s.',
    teamIntro: 'Idu Argus ITSM team, %s-ge %s sambandhisida issue kurithu call maaduttiddeve.',
    dtmfPrompt: 'Acknowledge maadalu 1 ottiri. Escalate maadalu 2 ottiri.',
    noResponse: 'Yaavathu pratikriye barillilla. Ee incident auto-escalate aaguttade.',
    closing: 'Dhanyavaadagalu %s. Yaavude prashne iddare Argus ITSM team annu le@finspot.in nalli samparksiri. Shubha %s.',
    acknowledged: '%s acknowledge aagide mattu In Progress-ge saagide.',
    escalated: '%s Priority 1 Critical-ge escalate aagide. On-call manager-ge tilidisalaagide.',
    errorGeneral: 'Naavu ondu taatkaalika samasyeyannu eduruttiddeve. Dayavittu nantara prayatnisiri. Dhanyavaadagalu.',
    invalidOption: 'Tappada option. Dayavittu matte prayatnisiri.',
  },
};

function getTemplate(langCode, key, ...args) {
  const lang = MESSAGE_TEMPLATES[langCode] || MESSAGE_TEMPLATES.en;
  let template = lang[key] || MESSAGE_TEMPLATES.en[key] || '';
  // Simple %s replacement
  let i = 0;
  template = template.replace(/%s/g, () => args[i++] ?? '');
  return template;
}

// ── Resolve language for a call context ──────────────────

async function resolveCallLanguage(incidentId, orgId, phone) {
  // Priority: caller user pref → incident org pref → 'en'
  if (phone) {
    const cleanPhone = phone.replace('+91', '').replace('+', '');
    const user = await prisma.user.findFirst({
      where: { phone: { contains: cleanPhone } },
      select: { preferredLanguage: true },
    });
    if (user?.preferredLanguage) return user.preferredLanguage;
  }
  if (orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { preferredLanguage: true },
    });
    if (org?.preferredLanguage) return org.preferredLanguage;
  }
  if (incidentId) {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: { organization: { select: { preferredLanguage: true } } },
    });
    if (incident?.organization?.preferredLanguage) return incident.organization.preferredLanguage;
  }
  return 'en';
}

// ── Transcription (Audio → Text) ────────────────────────

async function transcribe(audioBuffer, options = {}) {
  const { language = 'en', format = 'wav' } = options;

  try {
    const form = new FormData();
    form.append('audio', audioBuffer, { filename: `audio.${format}`, contentType: `audio/${format}` });
    form.append('language', language);

    const resp = await axios.post(`${VOICE_SERVER}/transcribe`, form, {
      headers: form.getHeaders(),
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024, // 50MB
    });

    logger.info(`Transcription complete: ${resp.data?.text?.substring(0, 50)}... [${language}]`);
    return {
      text: resp.data?.text,
      language: resp.data?.language || language,
      confidence: resp.data?.confidence,
      duration: resp.data?.duration,
    };
  } catch (err) {
    logger.error('Transcription failed:', err.message);
    throw new Error(`Transcription failed: ${err.message}`);
  }
}

// ── Speech Synthesis (Text → Audio) ─────────────────────

async function synthesize(text, options = {}) {
  const { language = 'en', voice = 'default', format = 'wav' } = options;

  try {
    const resp = await axios.post(`${VOICE_SERVER}/synthesize`, {
      text,
      language,
      voice,
      format,
    }, {
      timeout: 30000,
      responseType: 'arraybuffer',
    });

    logger.info(`Synthesis complete: ${text.substring(0, 50)}... [${language}]`);
    return {
      audio: Buffer.from(resp.data),
      contentType: `audio/${format}`,
      language,
    };
  } catch (err) {
    logger.error('Speech synthesis failed:', err.message);
    throw new Error(`Speech synthesis failed: ${err.message}`);
  }
}

// ── Voice Chat (Audio → LLM → Audio) ───────────────────

async function voiceChat(audioBuffer, options = {}) {
  const { language = 'en', sessionId, context } = options;

  try {
    const form = new FormData();
    form.append('audio', audioBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });
    form.append('language', language);
    if (sessionId) form.append('session_id', sessionId);
    if (context) form.append('context', JSON.stringify(context));

    const resp = await axios.post(`${VOICE_SERVER}/chat`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
      responseType: 'arraybuffer',
    });

    // Extract metadata from response headers
    const transcript = resp.headers['x-transcript'] || '';
    const responseText = resp.headers['x-response-text'] || '';
    const detectedLanguage = resp.headers['x-language'] || language;

    logger.info(`Voice chat: "${transcript.substring(0, 40)}..." → "${responseText.substring(0, 40)}..."`);
    return {
      audio: Buffer.from(resp.data),
      contentType: 'audio/wav',
      transcript,
      responseText,
      language: detectedLanguage,
    };
  } catch (err) {
    logger.error('Voice chat failed:', err.message);
    throw new Error(`Voice chat failed: ${err.message}`);
  }
}

// ── Build TwiML with incident details ───────────────────

function buildIncidentTwiml(incident, callerName, lang = 'en') {
  const org = incident.organization;
  const orgName = org?.name || 'Unknown Client';
  const env = org?.environment || '';

  // Time-based context for closing only
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hour = nowIST.getHours();
  const dayPart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  // Personal greeting — no time-of-day prefix
  const name = callerName || 'Sir';

  // Extract hostname/IP from description
  const hostMatch = incident.description?.match(/Host(?:name)?[:\s]+(\S+)/i);
  const ipMatch = incident.description?.match(/(?:IP|Instance|instance)[:\s]+([0-9.:]+)/i);
  const hostname = hostMatch?.[1] || '';
  const ip = ipMatch?.[1] || '';

  // Extract severity, metric, value from description
  const sevMatch = incident.description?.match(/Severity[:\s]+(\S+)/i);
  const metricMatch = incident.description?.match(/Metric[:\s]+(\S+)/i);
  const valueMatch = incident.description?.match(/Value[:\s]+(\S+)/i);
  const severity = sevMatch?.[1] || '';
  const metric = metricMatch?.[1]?.replace(/_/g, ' ') || '';
  const value = valueMatch?.[1] || '';

  // Format when it happened
  const createdAt = incident.createdAt ? new Date(incident.createdAt) : null;
  const timeAgo = createdAt ? getTimeAgo(createdAt) : '';
  let timeStr = '';
  if (createdAt) {
    const todayIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const createdIST = new Date(createdAt.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const isToday = todayIST.toDateString() === createdIST.toDateString();
    const timePart = createdIST.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
    timeStr = isToday ? `Today ${timePart}` : createdIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }) + ` ${timePart}`;
  }

  // Build location / application info from description
  const locationParts = [];
  if (hostname) locationParts.push(`host ${hostname}`);
  if (ip) locationParts.push(`I P ${ip}`);
  const location = locationParts.length ? locationParts.join(', ') : '';

  const appMatch = incident.description?.match(/Service[:\s]+([^\n]+)/i)
    || incident.description?.match(/Application[:\s]+([^\n]+)/i)
    || incident.description?.match(/Service Name[:\s]+([^\n]+)/i);
  const appName = appMatch?.[1]?.trim().substring(0, 60) || '';

  // Build the alert name in readable form
  const alertName = (incident.shortDescription || '')
    .replace(/^\[FIRING:\d+\]\s*/i, '')
    .replace(/^\[Alert\]\s*/i, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());

  // Format incident number for voice
  const rawNum = incident.number || '';
  const numericPart = rawNum.replace(/^INC0*/i, '') || rawNum;
  const incNumber = `I N C ${numericPart}`;

  // Client context line
  const orgSlug = org?.slug ? ` (${org.slug})` : '';
  const contextParts = [xmlEscape(orgName) + xmlEscape(orgSlug)];
  if (appName) contextParts.push(xmlEscape(appName));
  else if (location) contextParts.push(xmlEscape(location));
  const clientContext = contextParts.join(', ');

  // Build the announcement using language templates
  const greetingText = getTemplate(lang, 'greeting', xmlEscape(name));
  const teamIntro = getTemplate(lang, 'teamIntro', env || 'production', clientContext);
  const dtmfPrompt = getTemplate(lang, 'dtmfPrompt');
  const noResp = getTemplate(lang, 'noResponse');
  const closingText = getTemplate(lang, 'closing', xmlEscape(name), dayPart);

  const parts = [
    greetingText,
    teamIntro,
    '',
    `Incident ${incNumber}, Priority ${incident.priority || 'unknown'}.`,
    `Issue: ${xmlEscape(alertName)}.`,
    severity ? `Severity: ${xmlEscape(severity)}.` : '',
    metric ? `Metric: ${xmlEscape(metric)}, current value ${xmlEscape(value)}.` : '',
    '',
    location && !appName ? `Affected system: ${xmlEscape(location)}.` : '',
    timeStr ? `Detected at ${xmlEscape(timeStr)}, ${timeAgo}.` : '',
    '',
    dtmfPrompt,
  ].filter(Boolean).join(' ');

  const cfg = getLangConfig(lang);
  return `<Response><Say voice="${cfg.voice}" language="${cfg.language}">${parts}</Say><Gather numDigits="1" action="${WEBHOOK_GATHER}" method="POST" timeout="10"/><Pause length="2"/><Say voice="${cfg.voice}" language="${cfg.language}">${noResp} ${closingText}</Say></Response>`;
}

// ── Time ago helper ─────────────────────────────────────

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// ── Build TwiML with org greeting (no incident) ────────

function buildOrgGreetingTwiml(org, lang = 'en') {
  const orgName = org?.name || 'Argus';
  const env = org?.environment || '';
  const envLabel = env ? ` ${env} environment` : '';
  const cfg = getLangConfig(lang);

  const greetingText = getTemplate(lang, 'orgGreeting', xmlEscape(orgName), xmlEscape(envLabel));
  const noRespText = getTemplate(lang, 'orgNoResponse');

  return `<Response><Say voice="${cfg.voice}" language="${cfg.language}">${greetingText}</Say><Gather numDigits="1" action="${WEBHOOK_GATHER}" method="POST"/><Say voice="${cfg.voice}" language="${cfg.language}">${noRespText}</Say></Response>`;
}

// ── XML escape helper ───────────────────────────────────

function xmlEscape(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Twilio Voice Call (Outbound) ────────────────────────

async function makeCall(to, options = {}) {
  const { twiml, statusCallback, record = false, linkedIncidentId, organizationId, lang = 'en' } = options;
  const { accountSid, authToken, phoneNumber } = config.twilio;

  if (!accountSid || !authToken) throw new Error('Twilio credentials not configured');

  const params = {
    To: to,
    From: phoneNumber,
    Record: record,
  };

  // Use TwiML URL or inline TwiML
  if (twiml) {
    params.Twiml = twiml;
  } else {
    // Default IVR greeting (fallback when no org/incident context)
    const cfg = getLangConfig(lang);
    const defaultText = getTemplate(lang, 'defaultGreeting');
    params.Twiml = `<Response><Say voice="${cfg.voice}" language="${cfg.language}">${defaultText}</Say><Gather numDigits="1" action="${WEBHOOK_GATHER}" method="POST"/></Response>`;
  }

  if (statusCallback) params.StatusCallback = statusCallback;

  let resp;
  try {
    resp = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      new URLSearchParams(params),
      { auth: { username: accountSid, password: authToken } }
    );
  } catch (twilioErr) {
    const twilioBody = twilioErr.response?.data;
    logger.error(`Twilio call failed [${twilioErr.response?.status}]: ${JSON.stringify(twilioBody)} | To: ${to} From: ${phoneNumber}`);
    const msg = twilioBody?.message || twilioErr.message;
    const err = new Error(`Twilio: ${msg}`);
    err.statusCode = twilioErr.response?.status || 500;
    throw err;
  }

  // Log call with linked incident if provided
  await prisma.voiceCallLog.create({
    data: {
      callSid: resp.data?.sid,
      direction: 'OUTBOUND',
      callerNumber: to,
      handler: 'IVR',
      status: resp.data?.status || 'queued',
      ...(linkedIncidentId ? { linkedIncidentId } : {}),
      ...(organizationId ? { organizationId } : {}),
    },
  });

  logger.info(`Outbound call initiated to ${to} [${resp.data?.sid}]`);
  return { callSid: resp.data?.sid, status: resp.data?.status };
}

// ── Twilio Inbound Voice Webhook ────────────────────────

async function handleInboundCall(callData) {
  const { CallSid, From, CallerName, CallStatus } = callData;

  // Try to identify caller's org by matching phone number to a user
  let orgName = null;
  const callerUser = await prisma.user.findFirst({
    where: { phone: { contains: From?.replace('+91', '').replace('+', '') } },
    include: { organization: { select: { name: true } } },
  });
  if (callerUser?.organization?.name) {
    orgName = callerUser.organization.name;
  }

  // Log inbound call with org if found
  const callLog = await prisma.voiceCallLog.create({
    data: {
      callSid: CallSid,
      direction: 'INBOUND',
      callerNumber: From,
      callerName: CallerName || callerUser?.firstName || null,
      handler: 'AI_BOT',
      status: CallStatus || 'ringing',
      ...(callerUser?.organizationId ? { organizationId: callerUser.organizationId } : {}),
    },
  });

  logger.info(`Inbound call from ${From} [${CallSid}] org: ${orgName || 'unknown'}`);

  // Resolve language from caller preferences
  const lang = await resolveCallLanguage(null, callerUser?.organizationId || null, From);
  const cfg = getLangConfig(lang);
  const orgSuffix = orgName ? ` for ${xmlEscape(orgName)}` : '';
  const welcomeText = getTemplate(lang, 'welcome', orgSuffix);
  const describeText = getTemplate(lang, 'describeIssue');
  const noAudioText = getTemplate(lang, 'noAudio');

  // Return TwiML for AI-powered IVR
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${cfg.voice}" language="${cfg.language}">${welcomeText}</Say>
  <Gather input="speech" speechTimeout="auto" action="${WEBHOOK_SPEECH}" method="POST">
    <Say voice="${cfg.voice}" language="${cfg.language}">${describeText}</Say>
  </Gather>
  <Say voice="${cfg.voice}" language="${cfg.language}">${noAudioText}</Say>
</Response>`;
}

// ── Handle Twilio Speech Input ──────────────────────────

async function handleSpeechInput(speechData) {
  const { CallSid, SpeechResult, Confidence, From } = speechData;

  logger.info(`Speech input from ${From}: "${SpeechResult}" (confidence: ${Confidence})`);

  // Resolve language from caller
  const callLog = await prisma.voiceCallLog.findFirst({ where: { callSid: CallSid } });
  const lang = await resolveCallLanguage(callLog?.linkedIncidentId, callLog?.organizationId, From);
  const cfg = getLangConfig(lang);

  // Update call log with transcript
  await prisma.voiceCallLog.updateMany({
    where: { callSid: CallSid },
    data: { transcript: SpeechResult },
  });

  // Auto-create incident if confidence is high enough
  if (parseFloat(Confidence) > 0.6 && SpeechResult) {
    const confirmText = getTemplate(lang, 'speechConfirm', SpeechResult.substring(0, 100));
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${cfg.voice}" language="${cfg.language}">${confirmText}</Say>
  <Hangup/>
</Response>`;
  }

  const failText = getTemplate(lang, 'speechFail');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${cfg.voice}" language="${cfg.language}">${failText}</Say>
  <Dial>+919876543210</Dial>
</Response>`;
}

// ── Handle Twilio Gather (DTMF) ────────────────────────

async function handleGather(gatherData) {
  const { CallSid, Digits, From } = gatherData;

  logger.info(`DTMF input from ${From}: ${Digits} [${CallSid}]`);

  // Look up caller name
  const cleanPhone = From?.replace('+91', '').replace('+', '') || '';
  const callerUser = await prisma.user.findFirst({
    where: { phone: { contains: cleanPhone } },
    select: { firstName: true, lastName: true, preferredLanguage: true },
  });
  const callerName = callerUser ? `${callerUser.firstName}${callerUser.lastName ? ' ' + callerUser.lastName : ''}` : 'Sir';

  // Find linked incident from call log
  const callLog = await prisma.voiceCallLog.findFirst({ where: { callSid: CallSid } });
  const lang = await resolveCallLanguage(callLog?.linkedIncidentId, callLog?.organizationId, From);
  const cfg = getLangConfig(lang);
  let incidentInfo = '';
  let incNumber = '';
  let resolvedOrgName = '';

  if (callLog?.linkedIncidentId) {
    const incident = await prisma.incident.findUnique({
      where: { id: callLog.linkedIncidentId },
      include: { organization: { select: { name: true } } },
    });

    if (incident) {
      incNumber = incident.number || '';
      const orgName = incident.organization?.name || '';
      resolvedOrgName = orgName;
      const incLabel = `Incident ${incNumber}${orgName ? ' for ' + orgName : ''}`;
      const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });

      if (Digits === '1') {
        // Acknowledge — update incident state
        await prisma.incident.update({
          where: { id: incident.id },
          data: { state: 'IN_PROGRESS' },
        });

        // Stop escalation — mark all pending escalation logs as acknowledged
        await prisma.escalationLog.updateMany({
          where: { incidentId: incident.id, status: { in: ['ATTEMPTED', 'DELIVERED'] } },
          data: { status: 'ACKNOWLEDGED', respondedAt: new Date() },
        });

        if (systemUser) {
          await prisma.activity.create({
            data: {
              action: 'STATE_CHANGE',
              description: `Incident acknowledged via voice call by ${callerName} (${From}). State changed from ${incident.state} to IN_PROGRESS.`,
              incidentId: incident.id,
              userId: systemUser.id,
            },
          });
          await prisma.workNote.create({
            data: {
              content: `[Voice IVR] ${callerName} acknowledged incident via phone call.\nCall SID: ${CallSid}\nPrevious state: ${incident.state} → IN_PROGRESS`,
              isInternal: true,
              source: 'SYSTEM',
              incidentId: incident.id,
              authorId: systemUser.id,
            },
          });
        }
        incidentInfo = getTemplate(lang, 'acknowledged', incLabel);
        logger.info(`Incident ${incNumber} acknowledged via voice by ${callerName} (${From})`);
      } else if (Digits === '2') {
        // Escalate — update priority
        await prisma.incident.update({
          where: { id: incident.id },
          data: { state: 'IN_PROGRESS', priority: 'P1', urgency: 'CRITICAL' },
        });
        if (systemUser) {
          await prisma.activity.create({
            data: {
              action: 'ESCALATION',
              description: `Incident escalated via voice call by ${callerName} (${From}). Priority set to P1 Critical.`,
              incidentId: incident.id,
              userId: systemUser.id,
            },
          });
          await prisma.workNote.create({
            data: {
              content: `[Voice IVR] ${callerName} escalated incident via phone call.\nCall SID: ${CallSid}\nPriority escalated to P1 Critical`,
              isInternal: true,
              source: 'SYSTEM',
              incidentId: incident.id,
              authorId: systemUser.id,
            },
          });
        }
        incidentInfo = getTemplate(lang, 'escalated', incLabel);
        logger.info(`Incident ${incNumber} escalated via voice by ${callerName} (${From})`);
      }
    }
  }

  // Time-based closing
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hr = nowIST.getHours();
  const dayPart = hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening';
  const closing = getTemplate(lang, 'closing', xmlEscape(callerName), dayPart);

  // Resolve escalation contact — configurable per deployment
  const escalationNumber = process.env.ESCALATION_PHONE_NUMBER || '+919176772077';
  const ackRecordedText = getTemplate(lang, 'ackRecorded');
  const escalatingText = getTemplate(lang, 'escalatingNow');
  const invalidText = getTemplate(lang, 'invalidOption');

  switch (Digits) {
    case '1':
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${cfg.voice}" language="${cfg.language}">${xmlEscape(incidentInfo)} ${ackRecordedText} ${closing}</Say>
  <Hangup/>
</Response>`;
    case '2':
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${cfg.voice}" language="${cfg.language}">${xmlEscape(incidentInfo)} ${escalatingText}</Say>
  <Dial>${escalationNumber}</Dial>
</Response>`;
    default:
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${cfg.voice}" language="${cfg.language}">${invalidText} ${closing}</Say>
  <Hangup/>
</Response>`;
  }
}

// ── Call Status Update ──────────────────────────────────

async function handleCallStatusUpdate(statusData) {
  const { CallSid, CallStatus, CallDuration, RecordingUrl } = statusData;

  if (CallSid) {
    await prisma.voiceCallLog.updateMany({
      where: { callSid: CallSid },
      data: {
        status: CallStatus,
        duration: CallDuration ? parseInt(CallDuration, 10) : null,
        recordingUrl: RecordingUrl || null,
      },
    });
    logger.info(`Call status update: ${CallSid} → ${CallStatus} (${CallDuration}s)`);
  }

  // Handle no-answer / busy / failed → escalation retry for P1/P2
  if (['no-answer', 'busy', 'failed'].includes(CallStatus) && CallSid) {
    try {
      const failedCallLog = await prisma.voiceCallLog.findFirst({ where: { callSid: CallSid } });
      if (failedCallLog?.linkedIncidentId) {
        // Update any pending EscalationLog for this call
        await prisma.escalationLog.updateMany({
          where: { callSid: CallSid, status: 'ATTEMPTED' },
          data: { status: CallStatus === 'no-answer' ? 'NO_ANSWER' : CallStatus === 'busy' ? 'BUSY' : 'FAILED' },
        });

        // Check if this is a P1 incident → emit retry event
        const linkedInc = await prisma.incident.findUnique({
          where: { id: failedCallLog.linkedIncidentId },
          select: { id: true, number: true, priority: true, state: true },
        });
        if (linkedInc && ['P1', 'P2'].includes(linkedInc.priority) && linkedInc.state === 'NEW') {
          const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
          if (systemUser) {
            await prisma.activity.create({
              data: {
                action: 'ESCALATION',
                description: `Voice call ${CallStatus} (${CallSid}). Escalation retry triggered.`,
                incidentId: linkedInc.id,
                userId: systemUser.id,
              },
            });
          }
          getEventBus().emit('ESCALATION_RETRY_NEEDED', { incidentId: linkedInc.id, callSid: CallSid, status: CallStatus });
          logger.info(`Escalation retry emitted for ${linkedInc.number} after ${CallStatus}`);
        }
      }
    } catch (retryErr) {
      logger.error(`Escalation retry handling failed for ${CallSid}: ${retryErr.message}`);
    }
  }

  if (CallStatus === 'completed' && CallSid) {
    try {
      const callLog = await prisma.voiceCallLog.findFirst({ where: { callSid: CallSid } });
      const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });

      // Only auto-create incident if the call wasn't already linked to one
      // (outbound incident calls already have linkedIncidentId set)
      if (callLog && systemUser && !callLog.linkedIncidentId) {
        const now = new Date();
        const number = await generateIncidentNumber();
        const impact = 'TEAM';
        const urgency = 'MEDIUM';
        const priority = calculatePriority(impact, urgency);
        const slaTimes = calculateSLATargetTimes(priority, now);

        const incident = await prisma.incident.create({
          data: {
            number,
            shortDescription: `[Voice] Call ${callLog.direction} — ${callLog.callerNumber || 'Unknown'}`,
            description: [
              `Call SID: ${callLog.callSid}`,
              `Direction: ${callLog.direction}`,
              `Duration: ${callLog.duration ?? 0}s`,
              `Caller: ${callLog.callerNumber || 'Unknown'}`,
              callLog.transcript ? `Transcript: ${callLog.transcript}` : null,
            ].filter(Boolean).join('\n'),
            impact,
            urgency,
            priority,
            source: 'VOICE',
            category: 'Voice',
            state: 'NEW',
            ...slaTimes,
            createdById: systemUser.id,
          },
        });

        await prisma.voiceCallLog.update({
          where: { id: callLog.id },
          data: { linkedIncidentId: incident.id },
        });

        logger.info(`Auto-created incident ${incident.number} from call ${CallSid}`);
        getEventBus().emit('INCIDENT_CREATED', incident);
        dispatchEvent('VOICE_CALL_COMPLETED', {
          timestamp: now.toISOString(),
          callLog,
          incident: { id: incident.id, number: incident.number, priority: incident.priority },
        });
      }
    } catch (err) {
      logger.error(`Failed to auto-create incident for call ${CallSid}: ${err.message}`);
    }
  }
}

// ── Incident Alert Call (auto-updates incident) ────────

async function incidentAlertCall(incident, phoneNumber, lang = 'en') {
  const { accountSid, authToken, phoneNumber: fromNumber } = config.twilio;
  if (!accountSid || !authToken) throw new Error('Twilio credentials not configured');

  // Fetch org details if not already included
  let orgName = incident.organization?.name;
  if (!orgName && incident.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: incident.organizationId },
      select: { name: true, environment: true, preferredLanguage: true },
    });
    orgName = org?.name;
    if (!lang || lang === 'en') lang = org?.preferredLanguage || 'en';
  }
  orgName = orgName || 'Unknown Client';

  // Extract hostname/IP from description
  const hostMatch = incident.description?.match(/Host:\s*(\S+)/i)
    || incident.description?.match(/hostname[:\s]+(\S+)/i);
  const hostname = hostMatch?.[1] || 'unknown host';

  const ipMatch = incident.description?.match(/(?:IP|Instance|instance)[:\s]+([0-9.:]+)/i);
  const ip = ipMatch?.[1] || '';
  const ipInfo = ip ? ` I P ${ip}.` : '';

  const cfg = getLangConfig(lang);
  const alertText = getTemplate(lang, 'criticalAlert', xmlEscape(orgName), incident.number.replace(/(\w)/g, '$1 '), incident.priority, xmlEscape(hostname), ipInfo, xmlEscape(incident.shortDescription));
  const dtmfText = getTemplate(lang, 'dtmfPrompt');
  const noRespText = getTemplate(lang, 'orgNoResponse');

  // Build clear TwiML announcement with client details
  const twiml = `<Response><Say voice="${cfg.voice}" language="${cfg.language}">${alertText}</Say><Pause length="1"/><Say voice="${cfg.voice}" language="${cfg.language}">${dtmfText}</Say><Gather numDigits="1" action="${WEBHOOK_GATHER}" method="POST"/><Say voice="${cfg.voice}" language="${cfg.language}">${noRespText}</Say></Response>`;

  const params = {
    To: phoneNumber,
    From: fromNumber,
    Twiml: twiml,
  };

  const resp = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    new URLSearchParams(params),
    { auth: { username: accountSid, password: authToken } }
  );

  const callSid = resp.data?.sid;
  const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });

  // Create VoiceCallLog linked to incident
  await prisma.voiceCallLog.create({
    data: {
      callSid,
      direction: 'OUTBOUND',
      callerNumber: phoneNumber,
      handler: 'IVR',
      status: resp.data?.status || 'queued',
      linkedIncidentId: incident.id,
      ...(incident.organizationId ? { organizationId: incident.organizationId } : {}),
    },
  });

  // Create Activity on the incident
  await prisma.activity.create({
    data: {
      action: 'VOICE_ALERT',
      description: `Voice alert dispatched to ${phoneNumber} [Call SID: ${callSid}]`,
      incidentId: incident.id,
      userId: systemUser?.id || null,
    },
  });

  // Create WorkNote on the incident
  if (systemUser) {
    await prisma.workNote.create({
      data: {
        content: `[Voice Alert] Outbound call placed to ${phoneNumber}.\nCall SID: ${callSid}\nPriority: ${incident.priority}\nHost: ${hostname}\nIssue: ${incident.shortDescription}`,
        isInternal: true,
        source: 'SYSTEM',
        incidentId: incident.id,
        authorId: systemUser.id,
      },
    });
  }

  logger.info(`Incident alert call: ${incident.number} → ${phoneNumber} [${callSid}]`);
  return { callSid, status: resp.data?.status };
}

// ── Voice Server Health Check ───────────────────────────

async function healthCheck() {
  try {
    const resp = await axios.get(`${VOICE_SERVER}/health`, { timeout: 5000 });
    return {
      healthy: resp.status === 200,
      voiceServer: resp.data,
      url: VOICE_SERVER,
    };
  } catch (err) {
    return { healthy: false, message: err.message, url: VOICE_SERVER };
  }
}

// ── Supported Languages ─────────────────────────────────

function getSupportedLanguages() {
  return Object.entries(LANGUAGE_CONFIG).map(([code, cfg]) => ({ code, name: cfg.name }));
}

// ── Build Error TwiML (for controller catch blocks) ─────

function buildErrorTwiml(lang = 'en', key = 'errorGeneral') {
  const cfg = getLangConfig(lang);
  const text = getTemplate(lang, key);
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${cfg.voice}" language="${cfg.language}">${text}</Say><Hangup/></Response>`;
}

module.exports = {
  transcribe,
  synthesize,
  voiceChat,
  makeCall,
  buildIncidentTwiml,
  buildOrgGreetingTwiml,
  buildErrorTwiml,
  incidentAlertCall,
  handleInboundCall,
  handleSpeechInput,
  handleGather,
  handleCallStatusUpdate,
  healthCheck,
  getSupportedLanguages,
  resolveCallLanguage,
  getLangConfig,
  LANGUAGE_CONFIG,
};
