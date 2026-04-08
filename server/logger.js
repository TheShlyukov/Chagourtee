const winston = require('winston');
const path = require('path');
const fs = require('fs');

const LOG_DIR = path.join(__dirname, '..', 'data');
const LOG_FILE = path.join(LOG_DIR, 'chagourtee.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Check if logging to file is enabled
const shouldLogToFile = process.env.CHAGOURTEE_LOG_TO_FILE === 'true';

// Create custom transport that writes to both console and file if enabled
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message}${Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''}`;
    })
  )
});

const transports = [consoleTransport];

if (shouldLogToFile) {
  const fileTransport = new winston.transports.File({
    filename: LOG_FILE,
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}]: ${message}${Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''}`;
      })
    )
  });
  transports.push(fileTransport);
}

const logger = winston.createLogger({
  level: process.env.CHAGOURTEE_LOG_LEVEL || 'info',
  transports,
  exitOnError: false
});

module.exports = { logger, LOG_FILE };
