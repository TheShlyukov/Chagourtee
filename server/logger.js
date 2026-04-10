/**
 * Logger utility with file output and log levels
 * Supports: error, warn, info, debug, trace
 * Configured via CHAGOURTEE_LOG_LEVEL and CHAGOURTEE_LOG_TO_FILE
 *
 * When CHAGOURTEE_LOG_TO_FILE=true:
 *   - All logger.*() calls are written в файл и в консоль (с учётом уровня)
 *   - Перехваченные console.* тоже фильтруются по уровню
 */

const fs = require('fs');
const path = require('path');

// Log levels with numeric priorities (lower = more important)
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

// Determine log directory (relative to project root)
const isBundled = __dirname.includes('dist');
const PROJECT_ROOT = isBundled ? path.join(__dirname, '..', '..') : path.join(__dirname, '..');
const LOG_DIR = process.env.CHAGOURTEE_LOG_DIR || path.join(PROJECT_ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'chagourtee.log');

// Configuration
const logToFile = process.env.CHAGOURTEE_LOG_TO_FILE === 'true';
const logLevelEnv = (process.env.CHAGOURTEE_LOG_LEVEL || 'info').toLowerCase();
const currentLogLevel = LOG_LEVELS[logLevelEnv] !== undefined ? LOG_LEVELS[logLevelEnv] : LOG_LEVELS.info;

// Ensure log directory exists if file logging is enabled
if (logToFile && !fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    process.stderr.write(`Failed to create log directory: ${err.message}\n`);
  }
}

// Stream for file logging
let logStream = null;
if (logToFile) {
  try {
    logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  } catch (err) {
    // eslint-disable-next-line no-console
    process.stderr.write(`Failed to open log file: ${err.message}\n`);
  }
}

// Save original console methods BEFORE any interception
const _originalConsole = {
  log: process.stdout.write.bind(process.stdout),
  error: process.stderr.write.bind(process.stderr),
  warn: process.stderr.write.bind(process.stderr),
  info: process.stdout.write.bind(process.stdout),
  debug: process.stdout.write.bind(process.stdout),
};

/**
 * Format a log line with timestamp and level
 */
function formatLine(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
}

/**
 * Write a single line to both console and file
 */
function write(level, message) {
  // Filter by log level
  if (LOG_LEVELS[level] > currentLogLevel) {
    return;
  }

  const line = formatLine(level, message);

  // Write to console via original methods (avoid recursion)
  const lineStdout = line;
  const lineStderr = line;
  switch (level) {
    case 'error':
    case 'warn':
      _originalConsole.error(lineStderr);
      break;
    case 'debug':
    case 'trace':
      _originalConsole.debug(lineStdout);
      break;
    case 'info':
    default:
      _originalConsole.info(lineStdout);
      break;
  }

  // Write to file
  if (logStream) {
    logStream.write(line);
  }
}

/**
 * Intercept console methods — filter by level, write to both console and file
 */
function interceptConsole() {
  if (!logToFile) return;

  const map = {
    log: 'info',
    error: 'error',
    warn: 'warn',
    info: 'info',
    debug: 'debug',
  };

  for (const [method, level] of Object.entries(map)) {
    const original = _originalConsole[method];
    // eslint-disable-next-line no-console
    console[method] = (...args) => {
      const message = args.map(a => {
        if (typeof a === 'string') return a;
        if (a === null) return 'null';
        if (a === undefined) return 'undefined';
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch (e) { return String(a); }
        }
        return String(a);
      }).join(' ');

      // Check level filter
      if (LOG_LEVELS[level] > currentLogLevel) {
        // Still output to console (raw, unformatted) so dev can see it
        original(message + '\n');
        return;
      }

      // Write formatted line to both console (original) and file
      const line = formatLine(level, message);
      original(line);
      if (logStream) {
        logStream.write(line);
      }
    };
  }
}

interceptConsole();

/**
 * Logger object with methods for each log level
 */
const logger = {
  error: (message, ...args) => {
    const extra = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : '';
    write('error', message + extra);
  },
  warn: (message, ...args) => {
    const extra = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : '';
    write('warn', message + extra);
  },
  info: (message, ...args) => {
    const extra = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : '';
    write('info', message + extra);
  },
  debug: (message, ...args) => {
    const extra = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : '';
    write('debug', message + extra);
  },
  trace: (message, ...args) => {
    const extra = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : '';
    write('trace', message + extra);
  },

  close: () => {
    if (logStream) {
      logStream.end();
      logStream = null;
    }
  },

  getLogLevel: () => {
    const levelNames = Object.keys(LOG_LEVELS).sort((a, b) => LOG_LEVELS[a] - LOG_LEVELS[b]);
    return levelNames.find(name => LOG_LEVELS[name] === currentLogLevel) || 'info';
  },

  getLogFile: () => LOG_FILE,
};

/**
 * Clear the log file (delete and recreate)
 */
function clearLogs() {
  if (fs.existsSync(LOG_FILE)) {
    try {
      fs.unlinkSync(LOG_FILE);
      // Use raw stdout to avoid recursion
      process.stdout.write(`✅ Log file cleared: ${LOG_FILE}\n`);
    } catch (err) {
      process.stderr.write(`❌ Failed to clear log file: ${err.message}\n`);
      process.exit(1);
    }
  } else {
    process.stdout.write(`ℹ️  Log file does not exist: ${LOG_FILE}\n`);
  }
}

// Handle graceful shutdown to close log stream
process.on('SIGINT', () => {
  logger.close();
});

process.on('SIGTERM', () => {
  logger.close();
});

module.exports = { logger, clearLogs, LOG_LEVELS, LOG_FILE, LOG_DIR };
