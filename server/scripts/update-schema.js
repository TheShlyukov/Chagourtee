const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbPath = path.join(__dirname, '../data/chagourtee.db');
const db = new sqlite3.Database(dbPath);

// Check if updated_at column exists in messages table and ensure indexes / auxiliary tables
db.serialize(() => {
  // First, check if updated_at column exists
  db.all("PRAGMA table_info(messages)", (err, rows) => {
    if (err) {
      console.error('Error checking table schema:', err);
      finish();
      return;
    }

    const columns = rows.map(row => row.name);
    const hasUpdatedAt = columns.includes('updated_at');

    const tasks = [];

    if (!hasUpdatedAt) {
      tasks.push(new Promise((resolve) => {
        db.run('ALTER TABLE messages ADD COLUMN updated_at DATETIME DEFAULT NULL', (alterErr) => {
          if (alterErr) {
            console.error('Error adding updated_at column:', alterErr);
          } else if (process.env.DEBUG_MODE === 'true') {
            console.log('Adding updated_at column to messages table...');
            console.log('Column updated_at added successfully!');
          }
          resolve();
        });
      }));
    } else if (process.env.DEBUG_MODE === 'true') {
      console.log('updated_at column already exists.');
    }

    // Ensure index for updated_at column
    tasks.push(new Promise((resolve) => {
      db.get("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_messages_updated_at'", (idxErr, row) => {
        if (idxErr) {
          console.error('Error checking indexes:', idxErr);
          resolve();
          return;
        }

        if (!row) {
          db.run('CREATE INDEX idx_messages_updated_at ON messages(updated_at)', (createErr) => {
            if (createErr) {
              console.error('Error creating index:', createErr);
            } else if (process.env.DEBUG_MODE === 'true') {
              console.log('Adding index for updated_at column...');
              console.log('Index idx_messages_updated_at created successfully!');
            }
            resolve();
          });
        } else {
          if (process.env.DEBUG_MODE === 'true') {
            console.log('Index for updated_at column already exists.');
          }
          resolve();
        }
      });
    }));

    // Ensure message_reads table exists
    tasks.push(new Promise((resolve) => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='message_reads'", (tblErr, row) => {
        if (tblErr) {
          console.error('Error checking message_reads table:', tblErr);
          resolve();
          return;
        }

        if (!row) {
          db.run(
            `CREATE TABLE IF NOT EXISTS message_reads (
              message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              read_at TEXT NOT NULL DEFAULT (datetime('now')),
              PRIMARY KEY (message_id, user_id)
            )`,
            (createErr) => {
              if (createErr) {
                console.error('Error creating message_reads table:', createErr);
              } else if (process.env.DEBUG_MODE === 'true') {
                console.log('Table message_reads created successfully!');
              }
              resolve();
            }
          );
        } else {
          if (process.env.DEBUG_MODE === 'true') {
            console.log('message_reads table already exists.');
          }
          resolve();
        }
      });
    }));

    // Ensure index on message_reads.user_id
    tasks.push(new Promise((resolve) => {
      db.get("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_message_reads_user_id'", (idxErr, row) => {
        if (idxErr) {
          console.error('Error checking message_reads index:', idxErr);
          resolve();
          return;
        }

        if (!row) {
          db.run(
            'CREATE INDEX idx_message_reads_user_id ON message_reads(user_id)',
            (createErr) => {
              if (createErr) {
                console.error('Error creating idx_message_reads_user_id index:', createErr);
              } else if (process.env.DEBUG_MODE === 'true') {
                console.log('Index idx_message_reads_user_id created successfully!');
              }
              resolve();
            }
          );
        } else {
          if (process.env.DEBUG_MODE === 'true') {
            console.log('Index idx_message_reads_user_id already exists.');
          }
          resolve();
        }
      });
    }));

    Promise.all(tasks).then(finish);
  });

  function finish() {
    db.close(() => {
      if (process.env.DEBUG_MODE === 'true') {
        console.log('Database schema update completed.');
      }
    });
  }
});