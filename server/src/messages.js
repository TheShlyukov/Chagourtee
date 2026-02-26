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
        SELECT m.id, m.room_id, m.user_id, m.body, m.created_at, m.updated_at, u.login
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.room_id = ? AND m.id < ?
        ORDER BY m.id DESC
        LIMIT ?
      `).all(roomId, before, limit);
    } else {
      rows = db.prepare(`
        SELECT m.id, m.room_id, m.user_id, m.body, m.created_at, m.updated_at, u.login
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
      SELECT m.id, m.room_id, m.user_id, m.body, m.created_at, m.updated_at, u.login
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    if (process.env.DEBUG_MODE === 'true') {
      fastify.log.info(`About to broadcast new message to room ${roomId}:`, msg);
    }
    if (fastify.broadcastRoom) {
      if (process.env.DEBUG_MODE === 'true') {
        fastify.log.info(`Calling broadcastRoom for room ${roomId}`);
      }
      fastify.broadcastRoom(roomId, { type: 'message', message: msg });
      if (process.env.DEBUG_MODE === 'true') {
        fastify.log.info(`Called broadcastRoom for room ${roomId}`);
      }
    } else {
      if (process.env.DEBUG_MODE === 'true') {
        fastify.log.info(`broadcastRoom function not available on fastify instance`);
      }
    }
    return msg;
  });

  // Endpoint to edit a message
  fastify.patch('/api/rooms/:roomId/messages/:messageId', {
    preHandler: [fastify.requireAuth],
  }, async (request, reply) => {
    const roomId = Number(request.params.roomId);
    const messageId = Number(request.params.messageId);
    const { body } = request.body || {};

    if (!body || !String(body).trim()) {
      return reply.code(400).send({ error: 'Message body required' });
    }

    // Check if room exists
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });

    // Get the message
    const message = db.prepare(`
      SELECT m.id, m.room_id, m.user_id, m.body, u.role
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(messageId);

    if (!message) return reply.code(404).send({ error: 'Message not found' });

    if (message.room_id !== roomId) {
      return reply.code(400).send({ error: 'Message does not belong to room' });
    }

    // Check permissions: user can edit own message, or if they are owner/moderator
    const isOwnMessage = message.user_id === request.session.userId;
    const currentUser = fastify.getUser(request.session.userId);
    const isAllowed = isOwnMessage || fastify.isOwnerOrModerator(currentUser?.role);

    if (!isAllowed) {
      return reply.code(403).send({ error: 'Cannot edit another user\'s message' });
    }

    // Update the message
    const result = db.prepare(`
      UPDATE messages 
      SET body = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(String(body).trim(), messageId);

    // Get updated message
    const updatedMsg = db.prepare(`
      SELECT m.id, m.room_id, m.user_id, m.body, m.created_at, m.updated_at, u.login
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(messageId);

    // Broadcast update to all room participants
    if (process.env.DEBUG_MODE === 'true') {
      fastify.log.info(`About to broadcast message update to room ${roomId}:`, updatedMsg);
    }
    if (fastify.broadcastRoom) {
      if (process.env.DEBUG_MODE === 'true') {
        fastify.log.info(`Calling broadcastRoom for message update in room ${roomId}`);
      }
      fastify.broadcastRoom(roomId, { type: 'message_updated', message: updatedMsg });
      if (process.env.DEBUG_MODE === 'true') {
        fastify.log.info(`Called broadcastRoom for message update in room ${roomId}`);
      }
    } else {
      if (process.env.DEBUG_MODE === 'true') {
        fastify.log.info(`broadcastRoom function not available on fastify instance for update`);
      }
    }

    return updatedMsg;
  });

  // Endpoint to delete a message
  fastify.delete('/api/rooms/:roomId/messages/:messageId', {
    preHandler: [fastify.requireAuth],
  }, async (request, reply) => {
    const roomId = Number(request.params.roomId);
    const messageId = Number(request.params.messageId);

    // Check if room exists
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });

    // Get the message
    const message = db.prepare(`
      SELECT m.id, m.room_id, m.user_id, m.body, u.role
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(messageId);

    if (!message) return reply.code(404).send({ error: 'Message not found' });

    if (message.room_id !== roomId) {
      return reply.code(400).send({ error: 'Message does not belong to room' });
    }

    // Check permissions: user can delete own message, or if they are owner/moderator
    const isOwnMessage = message.user_id === request.session.userId;
    const currentUser = fastify.getUser(request.session.userId);
    const isAllowed = isOwnMessage || fastify.isOwnerOrModerator(currentUser?.role);

    if (!isAllowed) {
      return reply.code(403).send({ error: 'Cannot delete another user\'s message' });
    }

    // Delete the message
    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);

    if (process.env.DEBUG_MODE === 'true') {
      fastify.log.info(`About to broadcast message deletion for message ${messageId} in room ${roomId}`);
    }
    // Broadcast deletion to all room participants via WebSocket
    if (fastify.broadcastMessageDeleted) {
      if (process.env.DEBUG_MODE === 'true') {
        fastify.log.info(`Calling broadcastMessageDeleted for message ${messageId} in room ${roomId}`);
      }
      fastify.broadcastMessageDeleted(roomId, messageId, request.session.userId, currentUser?.login || request.session.userId);
      if (process.env.DEBUG_MODE === 'true') {
        fastify.log.info(`Called broadcastMessageDeleted for message ${messageId} in room ${roomId}`);
      }
    } else if (fastify.broadcastRoom) {
      if (process.env.DEBUG_MODE === 'true') {
        fastify.log.info(`Calling broadcastRoom for message deletion in room ${roomId}`);
      }
      fastify.broadcastRoom(roomId, { type: 'message_deleted', messageId, userId: request.session.userId, login: currentUser?.login || request.session.userId });
      if (process.env.DEBUG_MODE === 'true') {
        fastify.log.info(`Called broadcastRoom for message deletion in room ${roomId}`);
      }
    } else {
      if (process.env.DEBUG_MODE === 'true') {
        fastify.log.info(`No broadcast function available for message deletion`);
      }
    }

    return { success: true };
  });

  // Endpoint to delete multiple messages
  fastify.delete('/api/rooms/:roomId/messages/batch-delete', {
    preHandler: [fastify.requireAuth],
  }, async (request, reply) => {
    const roomId = Number(request.params.roomId);
    const { messageIds } = request.body || {};

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return reply.code(400).send({ error: 'Array of message IDs required' });
    }

    // Check if room exists
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });

    // Fetch messages to check permissions
    const placeholders = messageIds.map(() => '?').join(',');
    const messages = db.prepare(`
      SELECT m.id, m.room_id, m.user_id, u.role
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.id IN (${placeholders}) AND m.room_id = ?
    `).all([...messageIds, roomId]);

    // Check permissions for each message
    const currentUser = fastify.getUser(request.session.userId);
    const isModerator = fastify.isOwnerOrModerator(currentUser?.role);

    for (const msg of messages) {
      const isOwnMessage = msg.user_id === request.session.userId;
      if (!isOwnMessage && !isModerator) {
        return reply.code(403).send({ error: `Cannot delete message ${msg.id}: not your message and not moderator` });
      }
    }

    // Delete the messages
    const result = db.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`).run(messageIds);

    // Broadcast deletion to all room participants
    if (fastify.broadcastRoom) {
      fastify.broadcastRoom(roomId, { type: 'messages_deleted', messageIds });
    }

    return { ok: true, count: result.changes };
  });
};

// Helper function to check if user is owner or moderator
if (!module.parent) {
  module.exports.plugin = require('fastify-plugin')(module.exports, {
    name: 'messages',
  });
}