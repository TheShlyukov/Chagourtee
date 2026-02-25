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
    
    // Check if a room with this name already exists
    const existingRoom = db.prepare('SELECT id FROM rooms WHERE name = ?').get(String(name).trim());
    if (existingRoom) {
      return reply.code(400).send({ error: 'Room with this name already exists' });
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
    
    // Check if a room with this name already exists (excluding current room)
    const existingRoom = db.prepare('SELECT id FROM rooms WHERE name = ? AND id != ?').get(String(name).trim(), id);
    if (existingRoom) {
      return reply.code(400).send({ error: 'Room with this name already exists' });
    }
    
    const r = db.prepare('UPDATE rooms SET name = ? WHERE id = ?').run(String(name).trim(), id);
    if (r.changes === 0) return reply.code(404).send({ error: 'Room not found' });
    return db.prepare('SELECT id, name, created_at FROM rooms WHERE id = ?').get(id);
  });

  fastify.delete('/api/rooms/:id', {
    preHandler: [fastify.requireAuth, fastify.requireOwner],
  }, async (request, reply) => {
    const id = Number(request.params.id);
    
    // Check if this is the main room (assuming main room has id 1 or name 'main')
    const roomToCheck = db.prepare('SELECT id, name FROM rooms WHERE id = ?').get(id);
    if (!roomToCheck) return reply.code(404).send({ error: 'Room not found' });
    
    // Prevent deletion of the 'main' room
    if (roomToCheck.name === 'main') {
      return reply.code(400).send({ error: 'Main room cannot be deleted' });
    }
    
    // Get the room before deletion to broadcast the event
    const roomToDelete = roomToCheck;
    
    const r = db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    if (r.changes === 0) return reply.code(404).send({ error: 'Room not found' });
    
    // Broadcast room deletion to all connected clients
    if (fastify.broadcastRoomDeletion) {
      fastify.broadcastRoomDeletion(id);
    }
    
    return { ok: true };
  });
  
  // New endpoint to clear messages from a room
  fastify.delete('/api/rooms/:id/messages', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async (request, reply) => {
    const id = Number(request.params.id);
    
    // Check if room exists
    const room = db.prepare('SELECT id, name FROM rooms WHERE id = ?').get(id);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    
    // Delete all messages in the room
    const r = db.prepare('DELETE FROM messages WHERE room_id = ?').run(id);
    
    return { ok: true, message: `Cleared ${r.changes} messages from room` };
  });
  
  // Debug endpoint to drop tables (only available in development)
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true') {
    fastify.delete('/debug/drop-table/:tableName', {
      preHandler: [fastify.requireAuth, fastify.requireOwner],
    }, async (request, reply) => {
      const tableName = request.params.tableName;
      
      // Validate table name to prevent SQL injection
      const validTables = ['rooms', 'messages', 'users', 'sessions', 'invites', 'verification_codes', 'verification_settings'];
      if (!validTables.includes(tableName)) {
        return reply.code(400).send({ error: 'Invalid table name' });
      }
      
      try {
        // Note: We're using raw SQL with a whitelist, which is safe
        db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run();
        return { ok: true, message: `Table ${tableName} dropped` };
      } catch (error) {
        return reply.code(500).send({ error: error.message });
      }
    });
  }
};