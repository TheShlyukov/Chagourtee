const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fp = require('fastify-plugin');

const SALT_ROUNDS = 10;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function createSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function isOwnerOrModerator(role) {
  return role === 'owner' || role === 'moderator';
}

function requireAuth(fastify, _opts, done) {
  fastify.decorate('requireAuth', async function (request, reply) {
    if (!request.session?.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
  fastify.decorate('requireOwnerOrModerator', async function (request, reply) {
    if (!request.session?.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const user = fastify.getUser(request.session.userId);
    if (!user || !isOwnerOrModerator(user.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });
  fastify.decorate('requireOwner', async function (request, reply) {
    if (!request.session?.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const user = fastify.getUser(request.session.userId);
    if (!user || user.role !== 'owner') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });
  done();
}

function authRoutes(fastify, _opts, done) {
  const db = fastify.db;

  fastify.addHook('preHandler', async function (request, reply) {
    if (request.session?.userId) {
      const user = db.prepare('SELECT id, login, role, verified FROM users WHERE id = ?').get(request.session.userId);
      if (!user) {
        request.session = null;
        return;
      }
      if (!user.verified && !request.url.startsWith('/api/auth/') && !request.url.startsWith('/api/profile')) {
        const allowed = ['/api/auth/me', '/api/auth/logout', '/api/profile/change-password', '/api/profile/change-login', '/api/profile/codeword'];
        const allowedMatch = allowed.some((a) => request.url === a || request.url.startsWith(a + '?'));
        if (!allowedMatch) {
          return reply.code(403).send({ error: 'Account pending verification' });
        }
      }
    }
  });

  fastify.get('/api/auth/me', {
    preHandler: [fastify.requireAuth],
  }, async (request, reply) => {
    const user = fastify.getUser(request.session.userId);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    return {
      id: user.id,
      login: user.login,
      role: user.role,
      verified: Boolean(user.verified),
    };
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const { login, password } = request.body || {};
    if (!login || !password) {
      return reply.code(400).send({ error: 'Login and password required' });
    }
    const user = db.prepare('SELECT id, login, password_hash, role, verified FROM users WHERE login = ?').get(login.trim());
    if (!user || !verifyPassword(password, user.password_hash)) {
      return reply.code(401).send({ error: 'Invalid login or password' });
    }
    const sessionId = createSessionId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, user.id, expiresAt);
    request.session = { userId: user.id, sessionId };
    const cookieOpts = { httpOnly: true, path: '/', maxAge: SESSION_TTL_MS / 1000, sameSite: 'lax' };
    reply.setCookie('chagourtee_sid', sessionId, cookieOpts);
    return {
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
        verified: Boolean(user.verified),
      },
    };
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    if (request.session?.sessionId) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(request.session.sessionId);
    }
    reply.clearCookie('chagourtee_sid', { path: '/' });
    request.session = null;
    return { ok: true };
  });

  done();
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionId,
  isOwnerOrModerator,
  SESSION_TTL_MS,
};
module.exports.plugin = fp(requireAuth);
module.exports.authRoutes = authRoutes;
