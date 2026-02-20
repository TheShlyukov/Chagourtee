module.exports = function (fastify) {
  const db = fastify.db;

  fastify.get('/api/rooms/:roomId/messages', {
    preHandler: [fastify.requireAuth],
  }, async (request, reply) => {
    const roomId = Number(request.params.roomId);
    const limit = Math.min(Number(request.query.limit) || 50, 100);
    const before = request.query.before;

    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });

    let rows;
    if (before) {
      rows = db.prepare(`
        SELECT m.id, m.room_id, m.user_id, m.body, m.created_at, u.login
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.room_id = ? AND m.id < ?
        ORDER BY m.id DESC
        LIMIT ?
      `).all(roomId, before, limit);
    } else {
      rows = db.prepare(`
        SELECT m.id, m.room_id, m.user_id, m.body, m.created_at, u.login
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.room_id = ?
        ORDER BY m.id DESC
        LIMIT ?
      `).all(roomId, limit);
    }
    rows.reverse();
    return { messages: rows };
  });

  fastify.post('/api/rooms/:roomId/messages', {
    preHandler: [fastify.requireAuth],
  }, async (request, reply) => {
    const roomId = Number(request.params.roomId);
    const { body } = request.body || {};
    if (!body || !String(body).trim()) {
      return reply.code(400).send({ error: 'Message body required' });
    }

    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });

    const result = db.prepare(
      'INSERT INTO messages (room_id, user_id, body) VALUES (?, ?, ?)'
    ).run(roomId, request.session.userId, String(body).trim());
    const msg = db.prepare(`
      SELECT m.id, m.room_id, m.user_id, m.body, m.created_at, u.login
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    if (fastify.broadcastRoom) {
      fastify.broadcastRoom(roomId, { type: 'message', message: msg });
    }
    return msg;
  });
};
