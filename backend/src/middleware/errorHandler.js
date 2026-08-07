// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Global Error Handler
// ═══════════════════════════════════════════════════════════

const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  logger.error(err.message, { stack: err.stack, url: req.originalUrl, method: req.method });

  // Prisma errors
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'field';
    return res.status(409).json({ success: false, error: `Duplicate value for: ${field}` });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, error: 'Record not found' });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ success: false, error: 'Related record not found (foreign key)' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Token expired' });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large (max 10MB)' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({ success: false, error: 'Too many files (max 5)' });
  }

  // Validation errors (express-validator)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }

  const status = err.statusCode || err.status || 500;
  const message = status === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(status).json({ success: false, error: message });
}

module.exports = errorHandler;
