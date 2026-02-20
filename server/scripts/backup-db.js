#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { getDbPath } = require('../src/db');

const dbPath = getDbPath();
const backupDir = path.join(path.dirname(dbPath), 'backups');
const name = path.basename(dbPath, path.extname(dbPath));
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `${name}_${timestamp}.db`);

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found:', dbPath);
  process.exit(1);
}
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}
fs.copyFileSync(dbPath, backupPath);
console.log('Backup saved:', backupPath);
