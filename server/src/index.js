const path = require('path');
// Загружаем .env из корня проекта или из server/
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const fastify = require('fastify')({ logger: true });
const cookie = require('@fastify/cookie');
const { getDb } = require('./db');
const { createSessionId, hashPassword, verifyPassword, SESSION_TTL_MS } = require('./auth');
const authPlugin = require('./auth').plugin;
const { authRoutes } = require('./auth');

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

    const user = fastify.db.prepare('SELECT id, login, role, verified FROM users WHERE login = ?').get(loginTrim);
    if (!user) return reply.code(500).send({ error: 'Registration failed' });

    if (!bootstrapOk) {
      const sessionId = createSessionId();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      fastify.db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, user.id, expiresAt);
      reply.setCookie('chagourtee_sid', sessionId, {
        httpOnly: true,
        path: '/',
        maxAge: SESSION_TTL_MS / 1000,
        sameSite: 'lax',
      });
    } else {
      const sessionId = createSessionId();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      fastify.db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, user.id, expiresAt);
      reply.setCookie('chagourtee_sid', sessionId, {
        httpOnly: true,
        path: '/',
        maxAge: SESSION_TTL_MS / 1000,
        sameSite: 'lax',
      });
    }
    return {
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
        verified: Boolean(user.verified),
      },
    };
  });

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';

  fastify.setErrorHandler((err, request, reply) => {
    fastify.log.error(err);
    reply.code(err.statusCode || 500).send({ error: err.message || 'Internal error' });
  });

  await fastify.listen({ port, host });
  require('./ws')(fastify);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});