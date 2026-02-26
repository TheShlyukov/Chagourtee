const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'chagourtee.db');

function getDbPath() {
  return process.env.CHAGOURTEE_DB_PATH || DEFAULT_DB_PATH;
}

function ensureDataDir(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function updateSchema() {
  const dbPath = getDbPath();
  ensureDataDir(dbPath);
  
  const db = new Database(dbPath);
  
  // Check if updated_at column exists in messages table
  const columns = db.pragma('table_info(messages)');
  const updatedAtExists = columns.some(col => col.name === 'updated_at');
  
  if (!updatedAtExists) {
    if (process.env.DEBUG_MODE === 'true') {
      console.log('Adding updated_at column to messages table...');
    }
    db.exec('ALTER TABLE messages ADD COLUMN updated_at TEXT;');
    if (process.env.DEBUG_MODE === 'true') {
      console.log('Column updated_at added successfully!');
    }
  } else {
    if (process.env.DEBUG_MODE === 'true') {
      console.log('updated_at column already exists.');
    }
  }
  
  // Check if updated_at index exists
  const indexes = db.pragma('index_list(messages)');
  const indexExists = indexes.some(idx => idx.name === 'idx_messages_updated_at');
  
  if (!indexExists) {
    if (process.env.DEBUG_MODE === 'true') {
      console.log('Adding index for updated_at column...');
    }
    db.exec('CREATE INDEX idx_messages_updated_at ON messages(updated_at);');
    if (process.env.DEBUG_MODE === 'true') {
      console.log('Index idx_messages_updated_at created successfully!');
    }
  } else {
    if (process.env.DEBUG_MODE === 'true') {
      console.log('Index for updated_at column already exists.');
    }
  }
  
  db.close();
  if (process.env.DEBUG_MODE === 'true') {
    console.log('Database schema update completed.');
  }
}

if (require.main === module) {
  updateSchema();
}

module.exports = { updateSchema };