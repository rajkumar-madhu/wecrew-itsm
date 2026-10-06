// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — File Upload (Multer)
//
// Files land in UPLOAD_DIR (mount a persistent volume there in K8s) under a
// random name whose extension comes from the allow-listed MIME type, never
// from the client's filename. They are only ever served through the
// authenticated, tenant-checked /api/v1/attachments/:id/download route.
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } = require('../config/constants');

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
fs.mkdirSync(UPLOAD_DIR, { recursive: true }); // multer won't create a missing destination

const EXT_BY_MIME = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt', 'text/csv': '.csv', 'text/x-log': '.log',
  'application/json': '.json', 'application/x-yaml': '.yaml',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${EXT_BY_MIME[file.mimetype] || ''}`),
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
});

/** Absolute path of a stored file; basename() keeps a bad row from escaping the dir. */
function storedFilePath(filename) {
  return path.join(UPLOAD_DIR, path.basename(String(filename)));
}

module.exports = upload;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
module.exports.storedFilePath = storedFilePath;
