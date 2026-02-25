module.exports = function (fastify) {
  const db = fastify.db;

  fastify.get('/api/users', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async () => {
    const rows = db.prepare(`
      SELECT id, login, role, verified, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();
    return { users: rows };
  });

  fastify.patch('/api/users/:id/role', {
    preHandler: [fastify.requireAuth, fastify.requireOwner],
  }, async (request, reply) => {
    const userId = Number(request.params.id);
    const { role } = request.body || {};
    if (!['owner', 'moderator', 'member'].includes(role)) {
      return reply.code(400).send({ error: 'Invalid role' });
    }
    const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
    if (!target) return reply.code(404).send({ error: 'User not found' });
    if (target.role === 'owner' && role !== 'owner') {
      return reply.code(403).send({ error: 'Cannot demote owner' });
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
    return { ok: true };
  });

  fastify.delete('/api/users/:id', {
    preHandler: [fastify.requireAuth, fastify.requireOwner],
  }, async (request, reply) => {
    const userId = Number(request.params.id);
    const reason = request.body?.reason || 'Account removed by administrator';
    const target = db.prepare('SELECT id, role, login FROM users WHERE id = ?').get(userId);
    if (!target) return reply.code(404).send({ error: 'User not found' });
    if (target.role === 'owner') {
      return reply.code(403).send({ error: 'Cannot delete owner' });
    }
    if (userId === request.user.id) {
      return reply.code(403).send({ error: 'Cannot delete yourself' });
    }
    
    // Broadcast user deletion to all connected clients for this user
    const wsServer = fastify.ws.wss;
    if (wsServer) {
      const payload = {
        type: 'user_deleted',
        userId: userId,
        reason: reason
      };
      
      wsServer.clients.forEach((client) => {
        // Get the user ID associated with this WebSocket connection
        const clientId = fastify.ws.userByClient.get(client);
        if (client.readyState === 1 /* WebSocket.OPEN */ && clientId === userId) {
          client.send(JSON.stringify(payload));
        }
      });
    }
    
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM invites WHERE created_by = ?').run(userId);
    db.prepare('DELETE FROM rooms WHERE created_by = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return { ok: true };
  });

  fastify.patch('/api/users/:id/codeword', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async (request, reply) => {
    const userId = Number(request.params.id);
    const { codeword } = request.body || {};
    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!target) return reply.code(404).send({ error: 'User not found' });
    const { hashPassword } = require('./auth');
    const codewordHash = codeword ? hashPassword(codeword) : null;
    db.prepare('UPDATE users SET codeword_hash = ? WHERE id = ?').run(codewordHash, userId);
    return { ok: true };
  });

  fastify.post('/api/users/:id/disable-codeword-check', {
    preHandler: [fastify.requireAuth, fastify.requireOwnerOrModerator],
  }, async (request, reply) => {
    const userId = Number(request.params.id);
    const target = db.prepare('SELECT id, verified FROM users WHERE id = ?').get(userId);
    if (!target) return reply.code(404).send({ error: 'User not found' });
    db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(userId);
    
    // Broadcast verification status update
    const wsServer = fastify.ws.wss;
    if (wsServer) {
      const payload = {
        type: 'user_verified',
        userId: userId
      };
      
      wsServer.clients.forEach((client) => {
        const clientId = fastify.ws.userByClient.get(client);
        if (client.readyState === 1 /* WebSocket.OPEN */ && clientId === userId) {
          client.send(JSON.stringify(payload));
        }
      });
    }
    
    return { ok: true };
  });
};