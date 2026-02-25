const { verifyPassword, hashPassword } = require('./auth');
const crypto = require('crypto');

module.exports = function (fastify) {
  const db = fastify.db;

  // Проверяем, включена ли система верификации
  fastify.get('/api/verification/settings', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async () => {
    const setting = db.prepare('SELECT enabled FROM verification_settings LIMIT 1').get();
    return { enabled: setting ? !!setting.enabled : false };
  });

  // Включить/выключить систему верификации
  fastify.post('/api/verification/settings', {
    preHandler: [fastify.requireAuth, fastify.requireOwner],
  }, async (request, reply) => {
    const { enabled } = request.body || {};
    if (typeof enabled !== 'boolean') {
      return reply.code(400).send({ error: 'enabled must be boolean' });
    }

    // Удаляем старую запись, если существует
    db.prepare('DELETE FROM verification_settings').run();
    // Создаем новую запись
    db.prepare('INSERT INTO verification_settings (enabled) VALUES (?)').run(enabled ? 1 : 0);

    return { ok: true, enabled };
  });

  // Получить список ожидающих верификации пользователей
  fastify.get('/api/verification/pending', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async () => {
    const setting = db.prepare('SELECT enabled FROM verification_settings LIMIT 1').get();
    if (!setting || !setting.enabled) {
      // Если верификация отключена, возвращаем пустой массив
      return { pending: [] };
    }
    
    const rows = db.prepare(`
      SELECT id, login, created_at
      FROM users
      WHERE verified = 0 AND role = 'member'
      ORDER BY created_at ASC
    `).all();
    return { pending: rows };
  });

  // Проверка кодового слова для конкретного пользователя (для ручной верификации)
  fastify.post('/api/verification/check', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async (request, reply) => {
    const setting = db.prepare('SELECT enabled FROM verification_settings LIMIT 1').get();
    if (!setting || !setting.enabled) {
      return reply.code(400).send({ error: 'Verification system is disabled' });
    }
    
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

  // Одобрение пользователя (ручная верификация)
  fastify.post('/api/verification/approve', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async (request, reply) => {
    const setting = db.prepare('SELECT enabled FROM verification_settings LIMIT 1').get();
    if (!setting || !setting.enabled) {
      return reply.code(400).send({ error: 'Verification system is disabled' });
    }
    
    const { userId } = request.body || {};
    if (!userId) return reply.code(400).send({ error: 'userId required' });
    const r = db.prepare('UPDATE users SET verified = 1 WHERE id = ? AND verified = 0').run(Number(userId));
    if (r.changes === 0) return reply.code(404).send({ error: 'User not found or already verified' });
    return { ok: true };
  });

  // Отклонение пользователя
  fastify.post('/api/verification/reject', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async (request, reply) => {
    const setting = db.prepare('SELECT enabled FROM verification_settings LIMIT 1').get();
    if (!setting || !setting.enabled) {
      return reply.code(400).send({ error: 'Verification system is disabled' });
    }
    
    const { userId } = request.body || {};
    if (!userId) return reply.code(400).send({ error: 'userId required' });
    const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(Number(userId));
    if (!target) return reply.code(404).send({ error: 'User not found' });
    if (target.role === 'owner') return reply.code(403).send({ error: 'Cannot reject owner' });
    db.prepare('DELETE FROM users WHERE id = ?').run(Number(userId));
    return { ok: true };
  });
};