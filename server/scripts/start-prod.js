#!/usr/bin/env node
/**
 * Production start script for the bundled server
 * Ensures proper environment setup before starting
 */

const path = require('path');
const fs = require('fs');

const SERVER_ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(SERVER_ROOT, 'dist');
const DIST_FILE = path.join(DIST_DIR, 'index.js');
const DATA_DIR = path.join(SERVER_ROOT, 'data');

// Check if server is built
if (!fs.existsSync(DIST_FILE)) {
  console.error('❌ Server bundle not found!');
  console.error('   Please run: npm run build:server');
  console.error('   Or from root: npm run build');
  process.exit(1);
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  console.log('📁 Creating data directory...');
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load environment variables from .env if it exists
const envPath = path.join(SERVER_ROOT, '.env');
if (fs.existsSync(envPath)) {
  console.log('📄 Loading .env file...');
  require('dotenv').config({ path: envPath });
}

// Set NODE_ENV to production if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Start the bundled server
console.log('🚀 Starting bundled server...');
console.log(`   Data directory: ${DATA_DIR}`);
console.log(`   Node version: ${process.version}`);

// Execute the bundled server
const { spawn } = require('child_process');
const nodeProcess = spawn(process.execPath, [DIST_FILE], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV,
  },
});

nodeProcess.on('close', (code) => {
  process.exit(code);
});

nodeProcess.on('error', (err) => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});
