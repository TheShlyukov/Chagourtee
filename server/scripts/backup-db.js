#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbPath = path.join(__dirname, '../data/chagourtee.db');
const backupDir = path.join(__dirname, '../data/backups');

// Create backups directory if it doesn't exist
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Generate backup filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `chagourtee-backup-${timestamp}.db`);

// Perform the backup by copying the database file
fs.copyFileSync(dbPath, backupPath);

// Only output to console if DEBUG_MODE is enabled
if (process.env.DEBUG_MODE === 'true') {
  console.log('Backup saved:', backupPath);
}