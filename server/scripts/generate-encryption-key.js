#!/usr/bin/env node

/**
 * Script to generate a 32-byte encryption key for media file encryption
 * Usage: node scripts/generate-encryption-key.js
 */

const crypto = require('crypto');

function generateEncryptionKey() {
  // Generate a random 32-byte key for AES-256
  const key = crypto.randomBytes(32);
  const hexKey = key.toString('hex');
  
  console.log('Generated encryption key (32 bytes for AES-256-GCM):');
  console.log(hexKey);
  console.log('\nTo use this key:');
  console.log(`1. Add this to your .env file:`);
  console.log(`   CHAGOURTEE_MEDIA_ENCRYPTION_KEY=${hexKey}`);
  console.log('\n2. Make sure the key is exactly 32 bytes (64 hex characters)');
  console.log('3. Keep this key secret and secure');
  
  return hexKey;
}

// Only run if this file is executed directly
if (require.main === module) {
  generateEncryptionKey();
}

module.exports = generateEncryptionKey;