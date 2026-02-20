const { hashPassword, verifyPassword } = require('./auth');

module.exports = function (fastify) {
  const db = fastify.db;

  fastify.post('/api/profile/change-password', {
    preHandler: [fastify.requireAuth],
  }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body || {};
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: 'Current and new password required' });
    }
    if (String(newPassword).length < 6) {
      return reply.code(400).send({ error: 'New password too short' });
    }
    const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(request.session.userId);
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      return reply.code(401).send({ error: 'Current password is wrong' });
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
    return { ok: true };
  });

  fastify.post('/api/profile/change-login', {
    preHandler: [fastify.requireAuth],
  }, async (request, reply) => {
    const { password, newLogin } = request.body || {};
    if (!password || !newLogin) {
      return reply.code(400).send({ error: 'Password and new login required' });
    }
    const newLoginTrim = String(newLogin).trim();
    if (newLoginTrim.length < 2) return reply.code(400).send({ error: 'New login too short' });
    const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(request.session.userId);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return reply.code(401).send({ error: 'Password is wrong' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE login = ?').get(newLoginTrim);
    if (existing) return reply.code(400).send({ error: 'Login already taken' });
    db.prepare('UPDATE users SET login = ? WHERE id = ?').run(newLoginTrim, user.id);
    return { ok: true, login: newLoginTrim };
  });

  fastify.post('/api/profile/codeword', {
    preHandler: [fastify.requireAuth],
  }, async (request, reply) => {
    const { codeword } = request.body || {};
    const user = db.prepare('SELECT id, verified FROM users WHERE id = ?').get(request.session.userId);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    if (user.verified) return reply.code(400).send({ error: 'Already verified' });
    if (!codeword || typeof codeword !== 'string') {
      return reply.code(400).send({ error: 'Codeword required' });
    }
    db.prepare('UPDATE users SET codeword_hash = ? WHERE id = ?').run(hashPassword(codeword), user.id);
    return { ok: true, message: 'Codeword submitted; wait for owner verification' };
  });
};
