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
        if (msg.type === 'typing' && msg.roomId != null) {
          broadcastToRoom(Number(msg.roomId), { type: 'typing', userId, login: user?.login || userId });
        }
        if (msg.type === 'join' && msg.roomId != null) {
          ws.currentRoomId = Number(msg.roomId);
        }
      } catch (_) {}
    });

    ws.on('close', () => {
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
  });

  function broadcast(payload) {
    const data = JSON.stringify(payload);
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN) c.send(data);
    });
  }

  function broadcastToRoom(roomId, payload) {
    const data = JSON.stringify(payload);
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN && c.currentRoomId === roomId) c.send(data);
    });
  }

  fastify.broadcastRoom = function (roomId, payload) {
    broadcastToRoom(roomId, payload);
  };
  fastify.ws = wss;
};
