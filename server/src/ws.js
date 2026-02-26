const WebSocket = require('ws');
const { getDb } = require('./db');

const SESSION_COOKIE = 'chagourtee_sid';

function getUserIdFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const db = getDb();
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?').get(match[1].trim());
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return row.user_id;
}

module.exports = function (fastify) {
  const server = fastify.server;
  if (!server) return;

  const wss = new WebSocket.Server({ server, path: '/ws' });
  const clientsByUser = new Map();
  const userByClient = new Map();

  wss.on('connection', (ws, req) => {
    const userId = getUserIdFromCookie(req.headers.cookie);
    if (!userId) {
      ws.close(4001, 'Unauthorized');
      return;
    }
    
    // Set up heartbeat mechanism
    let heartbeatInterval = setInterval(() => {
      if (ws.isAlive === false) {
        // Client did not respond to ping, close connection
        ws.terminate();
        return;
      }
      
      ws.isAlive = false;
      // Send ping to client
      try {
        ws.ping();
      } catch (e) {
        // Connection might be dead, terminate it
        ws.terminate();
      }
    }, 35000); // Ping every 35 seconds (slightly more than client ping interval)
    
    // Mark connection as alive when pong is received
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    if (!clientsByUser.has(userId)) clientsByUser.set(userId, new Set());
    clientsByUser.get(userId).add(ws);
    userByClient.set(ws, userId);

    const user = fastify.getUser(userId);
    if (user) {
      broadcast({ type: 'presence', userId, login: user.login, online: true });
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (process.env.DEBUG_MODE === 'true') {
          fastify.log.info('Received WebSocket message:', msg);
        }
        
        if (msg.type === 'typing' && msg.roomId != null) {
          broadcastToRoom(Number(msg.roomId), { type: 'typing', userId, login: user?.login || userId }, ws);
        }
        if (msg.type === 'join' && msg.roomId != null) {
          ws.currentRoomId = Number(msg.roomId);
          if (process.env.DEBUG_MODE === 'true') {
            fastify.log.info(`User ${userId} joined room ${ws.currentRoomId}`);
          }
        }
        // Handle ping messages from client
        if (msg.type === 'ping') {
          // Respond with pong
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        // Handle message update
        if (msg.type === 'update_message' && msg.messageId && msg.content !== undefined) {
          if (process.env.DEBUG_MODE === 'true') {
            fastify.log.info(`Broadcasting message update: ${msg.messageId} in room ${msg.roomId}`);
          }
          broadcastToRoom(Number(msg.roomId), { 
            type: 'message_updated', 
            messageId: msg.messageId, 
            content: msg.content,
            userId, 
            login: user?.login || userId 
          }, ws);
        }
        // Handle message deletion
        if (msg.type === 'delete_message' && msg.messageId) {
          if (process.env.DEBUG_MODE === 'true') {
            fastify.log.info(`Broadcasting message deletion: ${msg.messageId} in room ${msg.roomId}`);
          }
          broadcastToRoom(Number(msg.roomId), { 
            type: 'message_deleted', 
            messageId: msg.messageId,
            userId, 
            login: user?.login || userId 
          }, ws);
        }
      } catch (_) {}
    });

    ws.on('close', () => {
      clearInterval(heartbeatInterval);
      userByClient.delete(ws);
      const set = clientsByUser.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          clientsByUser.delete(userId);
          broadcast({ type: 'presence', userId, login: user?.login, online: false });
        }
      }
    });
    
    // Mark connection as alive initially
    ws.isAlive = true;
  });

  // Periodically remove dead connections
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      // Ensure all connections are marked as not alive until next heartbeat
      ws.isAlive = false;
    });
  }, 40000); // Slightly more than ping interval

  function broadcast(payload) {
    const data = JSON.stringify(payload);
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN) c.send(data);
    });
  }
  
  // Broadcast message updates to all users in the room
  function broadcastMessageUpdated(roomId, messageId, content, userId, login) {
    const payload = JSON.stringify({
      type: 'message_updated',
      messageId,
      content,
      userId,
      login
    });
    
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN && c.currentRoomId === roomId) {
        c.send(payload);
      }
    });
  }
  
  // Broadcast message deletions to all users in the room
  function broadcastMessageDeleted(roomId, messageId, userId, login) {
    const payload = JSON.stringify({
      type: 'message_deleted',
      messageId,
      userId,
      login
    });
    
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN && c.currentRoomId === roomId) {
        c.send(payload);
      }
    });
  }

  function broadcastToRoom(roomId, payload, senderWs = null) {
    const data = JSON.stringify(payload);
    if (process.env.DEBUG_MODE === 'true') {
      fastify.log.info(`Broadcasting to room ${roomId}:`, payload.type);
    }
    let count = 0;
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN && c.currentRoomId === roomId) {
        // Don't send the message back to the sender
        if (c === senderWs) {
          return; // Skip the sender
        }
        if (process.env.DEBUG_MODE === 'true') {
          fastify.log.info(`Sending to client in room ${roomId}`);
        }
        c.send(data);
        count++;
      }
    });
    if (process.env.DEBUG_MODE === 'true') {
      fastify.log.info(`Sent to ${count} clients in room ${roomId}`);
    }
  }

  fastify.broadcastRoom = function (roomId, payload) {
    broadcastToRoom(roomId, payload);
  };
  
  // Broadcast message updates to all users in the room
  fastify.broadcastMessageUpdated = function (roomId, messageId, content, userId, login) {
    broadcastMessageUpdated(roomId, messageId, content, userId, login);
  };
  
  // Broadcast message deletions to all users in the room
  fastify.broadcastMessageDeleted = function (roomId, messageId, userId, login) {
    broadcastMessageDeleted(roomId, messageId, userId, login);
  };
  
  fastify.broadcastRoomDeletion = function (roomId) {
    broadcast({ type: 'room_deleted', roomId });
  };
  
  fastify.broadcastToUser = function (userId, payload) {
    const userClients = clientsByUser.get(userId);
    if (userClients) {
      const data = JSON.stringify(payload);
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
  };
  
  // Export the userByClient map so other modules can access it
  fastify.ws = {
    wss,
    clientsByUser,
    userByClient
  };
};