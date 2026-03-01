const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbPath = path.join(__dirname, '../data/chagourtee.db');
const db = new sqlite3.Database(dbPath);

// Check if updated_at column exists in messages table
db.serialize(() => {
  // First, check if updated_at column exists
  db.get("PRAGMA table_info(messages)", (err, rows) => {
    if (err) {
      console.error('Error checking table schema:', err);
      db.close();
      return;
    }

    const columns = rows.map(row => row.name);
    const hasUpdatedAt = columns.includes('updated_at');

    if (!hasUpdatedAt) {
      // Add updated_at column to messages table
      db.run('ALTER TABLE messages ADD COLUMN updated_at DATETIME DEFAULT NULL', (err) => {
        if (err) {
          console.error('Error adding updated_at column:', err);
        } else if (process.env.DEBUG_MODE === 'true') {
          console.log('Adding updated_at column to messages table...');
          console.log('Column updated_at added successfully!');
        }
      });
    } else if (process.env.DEBUG_MODE === 'true') {
      console.log('updated_at column already exists.');
    }
  });

  // Check if index exists for updated_at column
  db.get("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_messages_updated_at'", (err, row) => {
    if (err) {
      console.error('Error checking indexes:', err);
      db.close();
      return;
    }

    if (!row) {
      // Create index for updated_at column
      db.run('CREATE INDEX idx_messages_updated_at ON messages(updated_at)', (err) => {
        if (err) {
          console.error('Error creating index:', err);
        } else if (process.env.DEBUG_MODE === 'true') {
          console.log('Adding index for updated_at column...');
          console.log('Index idx_messages_updated_at created successfully!');
        }
      });
    } else if (process.env.DEBUG_MODE === 'true') {
      console.log('Index for updated_at column already exists.');
    }

    // Close the database connection after all operations
    db.close(() => {
      if (process.env.DEBUG_MODE === 'true') {
        console.log('Database schema update completed.');
      }
    });
  });
});