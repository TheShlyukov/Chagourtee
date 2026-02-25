module.exports = function (fastify) {
  const db = fastify.db;

  fastify.get('/api/rooms', {
    preHandler: [fastify.requireAuth],
  }, async () => {
    const rows = db.prepare(`
      SELECT r.id, r.name, r.created_at,
             (SELECT COUNT(*) FROM messages WHERE room_id = r.id) as message_count
      FROM rooms r
      ORDER BY r.created_at ASC
    `).all();
    return { rooms: rows };
  });

  fastify.post('/api/rooms', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async (request, reply) => {
    const { name } = request.body || {};
    if (!name || !String(name).trim()) {
      return reply.code(400).send({ error: 'Room name required' });
    }
    const result = db.prepare('INSERT INTO rooms (name, created_by) VALUES (?, ?)').run(
      String(name).trim(),
      request.session.userId
    );
    const room = db.prepare('SELECT id, name, created_at FROM rooms WHERE id = ?').get(result.lastInsertRowid);
    return room;
  });

  fastify.patch('/api/rooms/:id', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const { name } = request.body || {};
    if (!name || !String(name).trim()) return reply.code(400).send({ error: 'Room name required' });
    const r = db.prepare('UPDATE rooms SET name = ? WHERE id = ?').run(String(name).trim(), id);
    if (r.changes === 0) return reply.code(404).send({ error: 'Room not found' });
    return db.prepare('SELECT id, name, created_at FROM rooms WHERE id = ?').get(id);
  });

  fastify.delete('/api/rooms/:id', {
    preHandler: [fastify.requireAuth, fastify.requireOwner],
  }, async (request, reply) => {
    const id = Number(request.params.id);
    // Get the room before deletion to broadcast the event
    const roomToDelete = db.prepare('SELECT id, name FROM rooms WHERE id = ?').get(id);
    
    if (!roomToDelete) return reply.code(404).send({ error: 'Room not found' });
    
    const r = db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    if (r.changes === 0) return reply.code(404).send({ error: 'Room not found' });
    
    // Broadcast room deletion to all connected clients
    if (fastify.broadcastRoomDeletion) {
      fastify.broadcastRoomDeletion(id);
    }
    
    return { ok: true };
  });
};