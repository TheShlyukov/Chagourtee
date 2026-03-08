const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpeg = require('fluent-ffmpeg');
const { getDb } = require('./db');

// Directory for storing encrypted media files
const MEDIA_DIR = path.join(__dirname, '../data/media');

// Configure ffmpeg/fluent-ffmpeg binaries
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// TTL for cached audio transcodes (in ms). 0 or negative means infinite (until message deletion).
const AUDIO_TRANSCODE_TTL_MS = (() => {
    const days = parseInt(process.env.CHAGOURTEE_AUDIO_TRANSCODE_TTL_DAYS || '0', 10);
    if (!Number.isFinite(days) || days <= 0) return 0;
    return days * 24 * 60 * 60 * 1000;
})();

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
    // Allow all file types - no restriction
    return true;
}

/**
 * Analyze audio codec using ffprobe.
 * Writes buffer to a temporary file, runs ffprobe and returns codec info.
 */
function analyzeAudioCodec(buffer, originalName, mimeType) {
    return new Promise((resolve, reject) => {
        const tmpDir = os.tmpdir();
        const safeBase =
            path
                .basename(originalName || 'audio', path.extname(originalName || '')) || 'audio';
        const tmpInput = path.join(
            tmpDir,
            `${safeBase}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
        );

        try {
            fs.writeFileSync(tmpInput, buffer);
        } catch (e) {
            return reject(e);
        }

        ffmpeg()
            .input(tmpInput)
            .ffprobe((err, data) => {
                try {
                    fs.unlinkSync(tmpInput);
                } catch (_) {
                    // ignore
                }

                if (err) {
                    return reject(err);
                }

                const audioStream =
                    (data.streams || []).find((s) => s.codec_type === 'audio') || null;

                resolve({
                    codecName: audioStream ? audioStream.codec_name : null,
                    sampleRate: audioStream ? Number(audioStream.sample_rate) || null : null,
                    channels: audioStream ? audioStream.channels || null : null,
                    formatName: data.format ? data.format.format_name : null,
                    mimeType: mimeType || null,
                });
            });
    });
}

/**
 * Decide whether we should transcode given codec into FLAC.
 * We mainly target ALAC and AIFF/PCM big-endian, which are problematic for browsers.
 */
function shouldTranscodeToFlac(codecName, mimeType, originalName) {
    const lowerCodec = (codecName || '').toLowerCase();
    const lowerMime = (mimeType || '').toLowerCase();
    const lowerName = (originalName || '').toLowerCase();

    // Obvious problematic containers/extensions
    if (lowerMime.includes('aiff') || lowerMime.includes('aif')) return true;
    if (lowerName.endsWith('.aif') || lowerName.endsWith('.aiff')) return true;

    // Apple Lossless
    if (lowerCodec === 'alac') return true;

    // Big-endian PCM from AIFF or similar
    if (lowerCodec.startsWith('pcm_s') && lowerCodec.endsWith('be')) return true;

    // Known browser-friendly codecs we do NOT want to touch
    if (lowerCodec === 'aac') return false;
    if (lowerCodec === 'mp3') return false;
    if (lowerCodec === 'vorbis') return false;
    if (lowerCodec === 'opus') return false;

    // For m4a/aac containers, let them pass by default
    if (lowerMime === 'audio/aac' || lowerMime === 'audio/mp4' || lowerName.endsWith('.m4a')) {
        return false;
    }

    // Default: no transcode unless strongly suspicious
    return false;
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

    const db = fastify.db;

    /**
     * Ensure we have a FLAC transcode for problematic audio.
     * Returns object describing which encrypted file and mime type to serve.
     */
    async function ensureFlacTranscode(mediaFile) {
        const encryptionKey = process.env.CHAGOURTEE_MEDIA_ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error('Encryption key not configured');
        }
        const keyBuffer = Buffer.from(encryptionKey, 'hex');
        if (keyBuffer.length !== 32) {
            throw new Error('Invalid encryption key configuration');
        }

        const now = Date.now();

        // Helper to load and decrypt a given encrypted filename
        const loadDecryptedBuffer = (encryptedFilename) => {
            const filePath = path.join(MEDIA_DIR, encryptedFilename);
            if (!fs.existsSync(filePath)) {
                throw new Error('File not found on disk');
            }
            const encryptedBuffer = fs.readFileSync(filePath);
            return decryptFile(encryptedBuffer, keyBuffer);
        };

        // If we have existing transcode, check TTL
        if (mediaFile.transcoded_filename) {
            const createdAt = typeof mediaFile.transcoded_created_at === 'number'
                ? mediaFile.transcoded_created_at
                : null;

            const isExpired =
                AUDIO_TRANSCODE_TTL_MS > 0 &&
                createdAt !== null &&
                createdAt + AUDIO_TRANSCODE_TTL_MS < now;

            if (!isExpired) {
                const filePath = path.join(MEDIA_DIR, mediaFile.transcoded_filename);
                if (fs.existsSync(filePath)) {
                    return {
                        encryptedFilenameToServe: mediaFile.transcoded_filename,
                        mimeTypeToServe: mediaFile.transcoded_mime_type || 'audio/flac',
                        isTranscoded: true,
                    };
                }
            } else {
                // Delete expired transcode from disk if still present
                const filePath = path.join(MEDIA_DIR, mediaFile.transcoded_filename);
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                    } catch (e) {
                        fastify.log.error(
                            `Failed to delete expired transcoded media file ${filePath}:`,
                            e
                        );
                    }
                }
                // Clear metadata; will be re-created below if needed
                db.prepare(
                    `
                    UPDATE media_files
                    SET transcoded_filename = NULL,
                        transcoded_mime_type = NULL,
                        transcoded_created_at = NULL
                    WHERE id = ?
                `
                ).run(mediaFile.id);
                mediaFile.transcoded_filename = null;
                mediaFile.transcoded_mime_type = null;
                mediaFile.transcoded_created_at = null;
            }
        }

        // Analyze original to decide if transcode is needed
        let originalBuffer;
        try {
            originalBuffer = loadDecryptedBuffer(mediaFile.encrypted_filename);
        } catch (e) {
            throw e;
        }

        let codecInfo;
        try {
            codecInfo = await analyzeAudioCodec(
                originalBuffer,
                mediaFile.original_name,
                mediaFile.mime_type
            );
        } catch (e) {
            fastify.log.error(
                'Failed to analyze audio codec for media file',
                mediaFile.id,
                e
            );
            // If analysis fails, fall back to original
            return {
                encryptedFilenameToServe: mediaFile.encrypted_filename,
                mimeTypeToServe: mediaFile.mime_type,
                isTranscoded: false,
            };
        }

        const needTranscode = shouldTranscodeToFlac(
            codecInfo.codecName,
            mediaFile.mime_type,
            mediaFile.original_name
        );

        if (!needTranscode) {
            return {
                encryptedFilenameToServe: mediaFile.encrypted_filename,
                mimeTypeToServe: mediaFile.mime_type,
                isTranscoded: false,
            };
        }

        // Perform transcode to FLAC using ffmpeg
        const tmpDir = os.tmpdir();
        const safeBase =
            path
                .basename(mediaFile.original_name || 'audio', path.extname(mediaFile.original_name || '')) ||
            'audio';
        const tmpInput = path.join(
            tmpDir,
            `${safeBase}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}_in`
        );
        const tmpOutput = path.join(
            tmpDir,
            `${safeBase}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}_out.flac`
        );

        try {
            fs.writeFileSync(tmpInput, originalBuffer);
        } catch (e) {
            throw e;
        }

        try {
            await new Promise((resolve, reject) => {
                ffmpeg(tmpInput)
                    .toFormat('flac')
                    .on('error', (err) => {
                        reject(err);
                    })
                    .on('end', () => {
                        resolve();
                    })
                    .save(tmpOutput);
            });
        } catch (err) {
            fastify.log.error(
                'Failed to transcode audio to FLAC for media file',
                mediaFile.id,
                err
            );
            try {
                if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
            } catch (_) {}
            try {
                if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
            } catch (_) {}
            // On failure, fall back to original
            return {
                encryptedFilenameToServe: mediaFile.encrypted_filename,
                mimeTypeToServe: mediaFile.mime_type,
                isTranscoded: false,
            };
        }

        let flacBuffer;
        try {
            flacBuffer = fs.readFileSync(tmpOutput);
        } catch (e) {
            try {
                if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
            } catch (_) {}
            try {
                if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
            } catch (_) {}
            throw e;
        }

        try {
            if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
        } catch (_) {}
        try {
            if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
        } catch (_) {}

        const encryptedFlacBuffer = encryptFile(flacBuffer, keyBuffer);
        const flacEncryptedFilename = generateEncryptedFilename(
            `${mediaFile.original_name}.flac`
        );
        const flacEncryptedPath = path.join(MEDIA_DIR, flacEncryptedFilename);

        fs.writeFileSync(flacEncryptedPath, encryptedFlacBuffer);

        const createdAt = Date.now();
        db.prepare(
            `
            UPDATE media_files
            SET transcoded_filename = ?,
                transcoded_mime_type = ?,
                transcoded_created_at = ?
            WHERE id = ?
        `
        ).run(flacEncryptedFilename, 'audio/flac', createdAt, mediaFile.id);

        mediaFile.transcoded_filename = flacEncryptedFilename;
        mediaFile.transcoded_mime_type = 'audio/flac';
        mediaFile.transcoded_created_at = createdAt;

        return {
            encryptedFilenameToServe: flacEncryptedFilename,
            mimeTypeToServe: 'audio/flac',
            isTranscoded: true,
        };
    }

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
    
    // Endpoint for serving media files (with optional audio transcode + Range support)
    fastify.get(
        '/api/media/:filename',
        {
            preHandler: [fastify.requireAuth],
        },
        async (req, reply) => {
            try {
                const { filename } = req.params;

                // Verify filename is safe (prevent path traversal)
                if (filename.includes('../') || filename.includes('..\\')) {
                    return reply.code(400).send({ error: 'Invalid filename' });
                }

                // Look up media by original encrypted filename
                let mediaFile = db
                    .prepare(
                        `
                    SELECT mf.*, m.room_id
                    FROM media_files mf
                    LEFT JOIN messages m ON mf.message_id = m.id
                    WHERE mf.encrypted_filename = ?
                `
                    )
                    .get(filename);

                if (!mediaFile) {
                    // It may be that the client requested the transcoded filename directly
                    mediaFile = db
                        .prepare(
                            `
                        SELECT mf.*, m.room_id
                        FROM media_files mf
                        LEFT JOIN messages m ON mf.message_id = m.id
                        WHERE mf.transcoded_filename = ?
                    `
                        )
                        .get(filename);
                }

                if (!mediaFile) {
                    return reply.code(404).send({ error: 'File not found' });
                }

                // In Chagourtee, all authenticated users have access to all rooms,
                // so we only need to check if the media file is associated with a message
                // that belongs to a room (which is already checked by the query above)
                // and if the requesting user is authenticated (which is handled by preHandler)

                const isAudio =
                    typeof mediaFile.mime_type === 'string' &&
                    mediaFile.mime_type.toLowerCase().startsWith('audio/');

                let encryptedFilenameToServe = mediaFile.encrypted_filename;
                let mimeTypeToServe = mediaFile.mime_type;

                if (isAudio) {
                    try {
                        const result = await ensureFlacTranscode(mediaFile);
                        encryptedFilenameToServe = result.encryptedFilenameToServe;
                        mimeTypeToServe = result.mimeTypeToServe;
                    } catch (e) {
                        fastify.log.error('Failed to prepare audio media file:', e);
                        // Fallback: continue with original encrypted file if it exists
                        encryptedFilenameToServe = mediaFile.encrypted_filename;
                        mimeTypeToServe = mediaFile.mime_type;
                    }
                }

                const filePath = path.join(MEDIA_DIR, encryptedFilenameToServe);

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
                    console.error(
                        'CHAGOURTEE_MEDIA_ENCRYPTION_KEY must be 32 bytes for AES-256 (64 hex characters)'
                    );
                    return reply
                        .code(500)
                        .send({ error: 'Invalid encryption key configuration' });
                }

                // Decrypt file into memory
                const decryptedBuffer = decryptFile(encryptedBuffer, keyBuffer);

                const total = decryptedBuffer.length;
                const range = req.headers.range;

                reply.header('Accept-Ranges', 'bytes');

                if (!range) {
                    // No Range header: send whole content
                    reply
                        .code(200)
                        .header('Content-Length', String(total))
                        .type(mimeTypeToServe)
                        .send(decryptedBuffer);
                    return;
                }

                // Parse Range header: bytes=start-end
                const match = /^bytes=(\d*)-(\d*)$/.exec(range);
                if (!match) {
                    // Malformed Range
                    reply
                        .code(416)
                        .header('Content-Range', `bytes */${total}`)
                        .send();
                    return;
                }

                let start = match[1] === '' ? 0 : parseInt(match[1], 10);
                let end =
                    match[2] === ''
                        ? total - 1
                        : parseInt(match[2], 10);

                if (
                    Number.isNaN(start) ||
                    Number.isNaN(end) ||
                    start < 0 ||
                    end < start ||
                    start >= total
                ) {
                    reply
                        .code(416)
                        .header('Content-Range', `bytes */${total}`)
                        .send();
                    return;
                }

                if (end >= total) {
                    end = total - 1;
                }

                const chunk = decryptedBuffer.subarray(start, end + 1);
                const contentRange = `bytes ${start}-${end}/${total}`;

                reply
                    .code(206)
                    .header('Content-Range', contentRange)
                    .header('Content-Length', String(chunk.length))
                    .type(mimeTypeToServe)
                    .send(chunk);
            } catch (error) {
                console.error('Serve media error:', error);
                reply.code(500).send({
                    error: 'Failed to serve media',
                    details: error.message,
                });
            }
        }
    );
}

module.exports = mediaPlugin;