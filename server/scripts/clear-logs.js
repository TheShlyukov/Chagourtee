#!/usr/bin/env node
/**
 * Script to clear log files
 * Usage:
 *   node scripts/clear-logs.js           — clear all logs
 *   node scripts/clear-logs.js server    — clear server logs only
 *   node scripts/clear-logs.js client    — clear client logs only
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { clearLogs, LOG_FILE: SERVER_LOG_FILE, LOG_DIR } = require('../logger');

const CLIENT_LOG_FILE = path.join(LOG_DIR, 'client.log');

const mode = process.argv[2] || 'all'; // 'all', 'server', 'client'

function clearFile(filePath, name) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ ${name} log cleared: ${filePath}`);
    } catch (err) {
      console.error(`❌ Failed to clear ${name} log: ${err.message}`);
      return false;
    }
  } else {
    console.log(`ℹ️  ${name} log does not exist: ${filePath}`);
  }
  return true;
}

switch (mode) {
  case 'server':
    clearLogs();
    break;

  case 'client':
    clearFile(CLIENT_LOG_FILE, 'Client');
    break;

  case 'all':
  default:
    clearLogs();
    console.log('');
    clearFile(CLIENT_LOG_FILE, 'Client');
    break;
}
