// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Voice Routes
// ═══════════════════════════════════════════════════════════

const { Router } = require('express');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { validatePagination, validateUUID } = require('../middleware/validator');
const ctrl = require('../controllers/voice.controller');

const router = Router();

// Multer for audio file uploads (in-memory, max 25MB)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-wav'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported audio format: ${file.mimetype}`));
  },
});

// ── Authenticated Voice Endpoints ───────────────────────

router.use(authenticate);

// Core voice pipeline
router.post('/transcribe', audioUpload.single('audio'), ctrl.transcribe);
router.post('/synthesize', ctrl.synthesize);
router.post('/chat', audioUpload.single('audio'), ctrl.voiceChat);

// Outbound calls (admin/manager only)
router.post('/call', authorize('ADMIN', 'MANAGER'), ctrl.makeCall);

// Call logs
router.get('/calls', validatePagination, ctrl.getCallLogs);
router.get('/calls/:id', validateUUID, ctrl.getCallLog);
router.get('/stats', ctrl.getVoiceStats);

// Info
router.get('/languages', ctrl.getSupportedLanguages);
router.get('/health', ctrl.getHealth);

module.exports = router;
