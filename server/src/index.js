const path = require('path');
// Загружаем .env из корня проекта или из server/
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const fastify = require('fastify')({ logger: true });
const cookie = require('@fastify/cookie');
const { getDb } = require('./db');
const { hashPassword, verifyPassword, SESSION_TTL_MS, createSessionId } = require('./auth');
const authPlugin = require('./auth').plugin;
const { authRoutes, addAuthUtils } = require('./auth');

const SESSION_COOKIE = 'chagourtee_sid';

async function run() {
  const db = getDb();
  fastify.decorate('db', db);

  fastify.decorate('getUser', function (userId) {
    const row = db.prepare('SELECT id, login, role, verified, codeword_hash FROM users WHERE id = ?').get(userId);
    return row ? { ...row, verified: Boolean(row.verified) } : null;
  });

  await fastify.register(cookie, {
    secret: process.env.CHAGOURTEE_SESSION_SECRET || 'change-me-in-production',
  });
  await fastify.register(authPlugin);
  await fastify.register(addAuthUtils); // Register the auth utility functions

  fastify.addHook('preHandler', async function (request, reply) {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (!sessionId) return;
    const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?').get(sessionId);
    if (!row || new Date(row.expires_at) < new Date()) {
      if (row) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
      return;
    }
    request.session = { userId: row.user_id, sessionId };
    request.user = fastify.getUser(row.user_id);
  });

  // Add verification check for protected routes
  fastify.addHook('preHandler', async function (request, reply) {
    const setting = db.prepare('SELECT enabled FROM verification_settings LIMIT 1').get();
    const verificationEnabled = setting ? !!setting.enabled : false;
    
    // Only check verification for authenticated users on protected routes
    if (request.session && request.user && verificationEnabled) {
      const protectedPaths = [
        '/api/rooms',
        '/api/messages',
        '/api/invites',
        '/api/profile/change-password',
        '/api/profile/change-login'
      ];
      
      // Check if the current path is a protected route
      const isProtectedRoute = protectedPaths.some(path => 
        request.routeOptions.url.startsWith(path)
      );
      
      // Also check if it's a specific message route
      const isMessageRoute = /^\/api\/rooms\/\d+\/messages/.test(request.routeOptions.url);
      
      if ((isProtectedRoute || isMessageRoute) && !request.user.verified) {
        return reply.code(403).send({ 
          error: 'Account verification required',
          code: 'ACCOUNT_NOT_VERIFIED'
        });
      }
    }
  });

  await fastify.register(authRoutes);

  require('./rooms')(fastify);
  require('./messages')(fastify);
  require('./invites')(fastify);
  require('./profile')(fastify);
  require('./verification')(fastify);
  require('./users')(fastify);
  
  // Initialize WebSocket server
  require('./ws')(fastify);

  // Create the 'main' room if it doesn't exist and there is at least one user
  const existingMainRoom = db.prepare('SELECT id FROM rooms WHERE name = ?').get('main');
  if (!existingMainRoom) {
    // Check if there is at least one user in the database
    const firstUser = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get();
    
    if (firstUser) {
      // If a user exists, create the main room with that user as creator
      db.prepare('INSERT INTO rooms (name, created_by) VALUES (?, ?)').run('main', firstUser.id);
      if (process.env.DEBUG_MODE === 'true') {
        console.log("Created 'main' room on first startup with user ID:", firstUser.id);
      }
    } else {
      // If no users exist yet, we defer creating the main room until the first user registers
      if (process.env.DEBUG_MODE === 'true') {
        console.log("No users exist yet, deferring main room creation until first user registers.");
      }
    }
  } else {
    if (process.env.DEBUG_MODE === 'true') {
      console.log("Main room already exists, skipping creation.");
    }
  }

  fastify.post('/api/auth/register', async (request, reply) => {
    const { inviteId, login, password, codeword, bootstrap } = request.body || {};
    if (!login || !password) {
      return reply.code(400).send({ error: 'Login and password required' });
    }
    const loginTrim = login.trim();
    if (loginTrim.length < 2) return reply.code(400).send({ error: 'Login too short' });
    const existing = fastify.db.prepare('SELECT id FROM users WHERE login = ?').get(loginTrim);
    if (existing) return reply.code(400).send({ error: 'Login already taken' });

    const userCount = fastify.db.prepare('SELECT COUNT(*) as n FROM users').get();
    const isFirstUser = userCount.n === 0;
    const bootstrapOk = isFirstUser && bootstrap && bootstrap === process.env.CHAGOURTEE_BOOTSTRAP_SECRET;

    if (bootstrapOk) {
      fastify.db.prepare(
        'INSERT INTO users (login, password_hash, role, verified) VALUES (?, ?, ?, 1)'
      ).run(loginTrim, hashPassword(password), 'owner');
    } else {
      if (!inviteId) return reply.code(400).send({ error: 'Invite required' });
      const invite = fastify.db.prepare(
        'SELECT id, created_by, max_uses, uses_count, expires_at FROM invites WHERE id = ?'
      ).get(inviteId);
      if (!invite) return reply.code(400).send({ error: 'Invalid invite' });
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        return reply.code(400).send({ error: 'Invite expired' });
      }
      if (invite.max_uses != null && invite.uses_count >= invite.max_uses) {
        return reply.code(400).send({ error: 'Invite limit reached' });
      }
      // Check if verification is enabled globally
      const verificationSetting = fastify.db.prepare('SELECT enabled FROM verification_settings LIMIT 1').get();
      const isVerificationEnabled = verificationSetting ? !!verificationSetting.enabled : false;
      
      const codewordHash = codeword ? hashPassword(codeword) : null;
      // If verification is enabled, set user as unverified (0), otherwise auto-verify (1)
      const shouldBeVerified = isVerificationEnabled ? 0 : (codeword ? 0 : 1);
      
      fastify.db.prepare(
        'INSERT INTO users (login, password_hash, role, verified, codeword_hash) VALUES (?, ?, ?, ?, ?)'
      ).run(loginTrim, hashPassword(password), 'member', shouldBeVerified, codewordHash);
      fastify.db.prepare('UPDATE invites SET uses_count = uses_count + 1 WHERE id = ?').run(inviteId);
    }

    const userId = fastify.db.prepare('SELECT id FROM users WHERE login = ?').get(loginTrim).id;
    
    // After registering the first user, check if main room exists, if not create it
    if (isFirstUser) {
      const existingMainRoom = fastify.db.prepare('SELECT id FROM rooms WHERE name = ?').get('main');
      if (!existingMainRoom) {
        fastify.db.prepare('INSERT INTO rooms (name, created_by) VALUES (?, ?)').run('main', userId);
        if (process.env.DEBUG_MODE === 'true') {
          console.log("Created 'main' room for first user with ID:", userId);
        }
      }
    }

    const sessionId = createSessionId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    
    // Store session in DB
    fastify.db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
      sessionId,
      userId,
      expiresAt
    );
    
    // Set session cookie
    reply.setCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: Math.floor(SESSION_TTL_MS / 1000), // in seconds
      path: '/',
      sameSite: 'strict',
    });

    const user = fastify.getUser(userId);
    return { user };
  });

  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    if (process.env.DEBUG_MODE === 'true') {
      console.log(`Server listening on http://0.0.0.0:3000`);
    }
    
    // Check if debug mode is enabled
    if (process.env.DEBUG_MODE === 'true') {
      console.log("Debug endpoints enabled");
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

run();