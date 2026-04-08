#!/usr/bin/env node
/**
 * Clear log files script
 * Removes contents of chagourtee.log file
 */

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'chagourtee.log');

function main() {
  // Check if log file exists
  if (!fs.existsSync(LOG_FILE)) {
    console.log('ℹ️  Log file does not exist:', LOG_FILE);
    return;
  }

  try {
    // Clear the log file by writing empty string
    fs.writeFileSync(LOG_FILE, '', 'utf8');
    console.log('✅ Log file cleared:', LOG_FILE);
  } catch (error) {
    console.error('❌ Failed to clear log file:', error.message);
    process.exit(1);
  }
}

main();
