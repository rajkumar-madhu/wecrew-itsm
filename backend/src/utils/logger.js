// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Winston Logger
// ═══════════════════════════════════════════════════════════

const winston = require('winston');
require('winston-daily-rotate-file');
const morgan = require('morgan');

const isProd = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    isProd ? winston.format.json() : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  defaultMeta: { service: 'linkedeye-api' },
  transports: [
    new winston.transports.Console(),
    ...(isProd
      ? [
          new winston.transports.DailyRotateFile({
            filename: 'logs/combined-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
          }),
          new winston.transports.DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '30d',
          }),
        ]
      : []),
  ],
});

const morganMiddleware = morgan(isProd ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.http(msg.trim()) },
});

module.exports = logger;
module.exports.morganMiddleware = morganMiddleware;
