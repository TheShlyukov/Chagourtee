module.exports = function (fastify) {
  const db = fastify.db;

  // Get current server settings (public, no auth required)
  fastify.get('/api/server/settings', async () => {
    const row = db.prepare('SELECT name FROM server_settings WHERE id = 1').get();
    return { name: row ? row.name : null };
  });

  // Update server name (only owner)
  fastify.post('/api/server/settings', {
    preHandler: [fastify.requireAuth, fastify.requireOwner],
  }, async (request, reply) => {
    const { name } = request.body || {};
    const raw = typeof name === 'string' ? name : '';
    const trimmed = raw.trim();

    if (trimmed.length > 100) {
      return reply.code(400).send({ error: 'Server name too long' });
    }

    const existing = db.prepare('SELECT id FROM server_settings WHERE id = 1').get();
    const now = new Date().toISOString();

    if (existing) {
      db.prepare('UPDATE server_settings SET name = ?, updated_at = ? WHERE id = 1')
        .run(trimmed || null, now);
    } else {
      db.prepare('INSERT INTO server_settings (id, name, created_at, updated_at) VALUES (1, ?, ?, ?)')
        .run(trimmed || null, now, now);
    }

    return { name: trimmed || null };
  });
};

