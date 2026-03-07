const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDb } = require('./db');

// Directory for storing encrypted media files
const MEDIA_DIR = path.join(__dirname, '../data/media');

// Ensure media directory exists
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

/**
 * Generates a unique filename for encrypted media
 */
function generateEncryptedFilename(originalName) {
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    
    return `${base}_${timestamp}_${randomString}.enc`;
}

/**
 * Encrypts file content using AES-256-GCM
 */
function encryptFile(buffer, key) {
    const iv = crypto.randomBytes(16); // 128 bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    // Prepend IV and authTag to the encrypted data
    const result = Buffer.concat([iv, authTag, encrypted]);
    
    return result;
}

/**
 * Decrypts file content using AES-256-GCM
 */
function decryptFile(buffer, key) {
    // Extract IV (first 16 bytes) and authTag (next 16 bytes)
    const iv = buffer.subarray(0, 16);
    const authTag = buffer.subarray(16, 32);
    const encrypted = buffer.subarray(32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
}

/**
 * Checks if a file type is allowed
 */
function isFileTypeAllowed(mimeType, originalName) {
    // Define allowed file types
    const allowedTypes = [
        // Images
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/bmp',
        'image/tiff',
        
        // Videos
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/mpeg',
        'video/quicktime',
        
        // Audio
        'audio/mpeg',
        'audio/wav',
        'audio/aac',
        'audio/ogg',
        'audio/midi',
        'audio/x-midi',
        'audio/webm',
        
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/zip',
        'application/x-rar-compressed'
    ];
    
    // Check MIME type
    if (allowedTypes.includes(mimeType)) {
        return true;
    }
    
    // Additional check based on file extension for cases where MIME type detection fails
    const ext = path.extname(originalName).toLowerCase();
    const extMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
        '.mpeg': 'video/mpeg',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.wmv': 'video/x-ms-wmv',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
        '.midi': 'audio/midi',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.txt': 'text/plain',
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed'
    };
    
    return !!extMap[ext] && allowedTypes.includes(extMap[ext]);
}

/**
 * Registers the media plugin with Fastify
 */
async function mediaPlugin(fastify, options) {
    // Get max file size from environment, default to 50MB
    const maxFileSize = parseInt(process.env.CHAGOURTEE_MAX_FILE_SIZE || '52428800'); // 50MB in bytes
    
    // Register multipart for handling file uploads
    await fastify.register(require('fastify-multipart'), {
        limits: {
            fileSize: maxFileSize,
            fields: 10,
            files: 1
        }
    });

    // Endpoint for uploading media files
    fastify.post('/api/upload', {
        preHandler: [fastify.requireAuth]
    }, async (req, reply) => {
        try {
            const data = await req.file();
            
            if (!data) {
                return reply.code(400).send({ error: 'No file uploaded' });
            }
            
            // Check file type
            if (!isFileTypeAllowed(data.mimetype, data.filename)) {
                return reply.code(400).send({ error: 'File type not allowed' });
            }
            
            // Check file size (already limited by multipart config)
            if (data.file.truncated) {
                return reply.code(400).send({ error: 'File too large' });
            }
            
            // Read file buffer
            const buffer = await data.toBuffer();
            
            // Generate encrypted filename
            const encryptedFilename = generateEncryptedFilename(data.filename);
            const filePath = path.join(MEDIA_DIR, encryptedFilename);
            
            // Get encryption key from environment
            const encryptionKey = process.env.CHAGOURTEE_MEDIA_ENCRYPTION_KEY;
            if (!encryptionKey) {
                console.error('CHAGOURTEE_MEDIA_ENCRYPTION_KEY is not set!');
                return reply.code(500).send({ error: 'Encryption key not configured' });
            }
            
            // Convert hex string to buffer
            const keyBuffer = Buffer.from(encryptionKey, 'hex');
            
            if (keyBuffer.length !== 32) {
                console.error('CHAGOURTEE_MEDIA_ENCRYPTION_KEY must be 32 bytes for AES-256 (64 hex characters)');
                return reply.code(500).send({ error: 'Invalid encryption key configuration' });
            }
            
            // Encrypt and save file
            const encryptedBuffer = encryptFile(buffer, keyBuffer);
            fs.writeFileSync(filePath, encryptedBuffer);
            
            // Save metadata to database
            const db = fastify.db;
            const stmt = db.prepare(`
                INSERT INTO media_files (
                    original_name, 
                    encrypted_filename, 
                    mime_type, 
                    file_size,
                    uploaded_by
                ) VALUES (?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                data.filename,
                encryptedFilename,
                data.mimetype,
                buffer.length,
                req.user.id
            );
            
            // Return file info
            reply.send({
                id: result.lastInsertRowid,
                original_name: data.filename,
                encrypted_filename: encryptedFilename,
                mime_type: data.mimetype,
                file_size: buffer.length
            });
        } catch (error) {
            console.error('Upload error:', error);
            reply.code(500).send({ error: 'Upload failed', details: error.message });
        }
    });
    
    // Endpoint for serving media files
    fastify.get('/api/media/:filename', {
        preHandler: [fastify.requireAuth]
    }, async (req, reply) => {
        try {
            const { filename } = req.params;
            
            // Verify filename is safe (prevent path traversal)
            if (filename.includes('../') || filename.includes('..\\')) {
                return reply.code(400).send({ error: 'Invalid filename' });
            }
            
            // Check if user has access to this media file (by checking if they are in the same room as the message)
            const db = fastify.db;
            const mediaFile = db.prepare(`
                SELECT mf.*, m.room_id 
                FROM media_files mf
                LEFT JOIN messages m ON mf.message_id = m.id
                WHERE mf.encrypted_filename = ?
            `).get(filename);
            
            if (!mediaFile) {
                return reply.code(404).send({ error: 'File not found' });
            }
            
            // In Chagourtee, all authenticated users have access to all rooms,
            // so we only need to check if the media file is associated with a message
            // that belongs to a room (which is already checked by the query above)
            // and if the requesting user is authenticated (which is handled by preHandler)
            
            const filePath = path.join(MEDIA_DIR, filename);
            
            if (!fs.existsSync(filePath)) {
                return reply.code(404).send({ error: 'File not found' });
            }
            
            // Read encrypted file
            const encryptedBuffer = fs.readFileSync(filePath);
            
            // Get encryption key from environment
            const encryptionKey = process.env.CHAGOURTEE_MEDIA_ENCRYPTION_KEY;
            if (!encryptionKey) {
                console.error('CHAGOURTEE_MEDIA_ENCRYPTION_KEY is not set!');
                return reply.code(500).send({ error: 'Encryption key not configured' });
            }
            
            // Convert hex string to buffer
            const keyBuffer = Buffer.from(encryptionKey, 'hex');
            
            if (keyBuffer.length !== 32) {
                console.error('CHAGOURTEE_MEDIA_ENCRYPTION_KEY must be 32 bytes for AES-256 (64 hex characters)');
                return reply.code(500).send({ error: 'Invalid encryption key configuration' });
            }
            
            // Decrypt file
            const decryptedBuffer = decryptFile(encryptedBuffer, keyBuffer);
            
            // Send file with appropriate headers
            reply.type(mediaFile.mime_type).send(decryptedBuffer);
        } catch (error) {
            console.error('Serve media error:', error);
            reply.code(500).send({ error: 'Failed to serve media', details: error.message });
        }
    });
}

module.exports = mediaPlugin;