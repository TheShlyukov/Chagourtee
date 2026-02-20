const { verifyPassword } = require('./auth');

module.exports = function (fastify) {
  const db = fastify.db;

  fastify.get('/api/verification/pending', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async () => {
    const rows = db.prepare(`
      SELECT id, login, created_at
      FROM users
      WHERE verified = 0 AND role = 'member'
      ORDER BY created_at ASC
    `).all();
    return { pending: rows };
  });

  fastify.post('/api/verification/check', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async (request, reply) => {
    const { userId, codeword } = request.body || {};
    if (!userId || codeword === undefined) {
      return reply.code(400).send({ error: 'userId and codeword required' });
    }
    const user = db.prepare('SELECT id, codeword_hash FROM users WHERE id = ? AND verified = 0').get(Number(userId));
    if (!user) return reply.code(404).send({ error: 'User not found or already verified' });
    if (!user.codeword_hash) {
      return { match: false, message: 'User has no codeword set' };
    }
    const match = verifyPassword(codeword, user.codeword_hash);
    return { match };
  });

  fastify.post('/api/verification/approve', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async (request, reply) => {
    const { userId } = request.body || {};
    if (!userId) return reply.code(400).send({ error: 'userId required' });
    const r = db.prepare('UPDATE users SET verified = 1 WHERE id = ? AND verified = 0').run(Number(userId));
    if (r.changes === 0) return reply.code(404).send({ error: 'User not found or already verified' });
    return { ok: true };
  });

  fastify.post('/api/verification/reject', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async (request, reply) => {
    const { userId } = request.body || {};
    if (!userId) return reply.code(400).send({ error: 'userId required' });
    const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(Number(userId));
    if (!target) return reply.code(404).send({ error: 'User not found' });
    if (target.role === 'owner') return reply.code(403).send({ error: 'Cannot reject owner' });
    db.prepare('DELETE FROM users WHERE id = ?').run(Number(userId));
    return { ok: true };
  });
};
