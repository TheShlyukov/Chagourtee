import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Room, Message } from '../api';
import { rooms as roomsApi, messages as messagesApi } from '../api';

const WS_BASE = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;

export default function Chat() {
  const { roomId: routeRoomId } = useParams();
  const roomId = routeRoomId ? Number(routeRoomId) : null;
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendText, setSendText] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(0);

  const loadRooms = useCallback(async () => {
    const { rooms } = await roomsApi.list();
    setRoomList(rooms);
  }, []);

  const loadMessages = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const { messages: list } = await messagesApi.list(id);
      setMessages(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (roomId) loadMessages(roomId);
    else setMessages([]);
  }, [roomId, loadMessages]);

  useEffect(() => {
    if (!roomId) return;
    const ws = new WebSocket(`${WS_BASE}/ws`);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', roomId }));
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.message?.room_id === roomId) {
          setMessages((prev) => [...prev, data.message]);
        }
        if (data.type === 'typing' && data.roomId === roomId) {
          setTyping(data.login || String(data.userId));
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setTyping(null), 3000);
        }
      } catch {}
    };
    return () => {
      ws.close();
      wsRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId || !sendText.trim()) return;
    const text = sendText.trim();
    setSendText('');
    try {
      await messagesApi.send(roomId, text);
    } catch (err) {
      setSendText(text);
      alert(err instanceof Error ? err.message : 'Не удалось отправить');
    }
  }

  function handleTyping() {
    if (wsRef.current?.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(JSON.stringify({ type: 'typing', roomId }));
    }
  }

  if (roomList.length === 0 && !loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>
        Нет комнат. Создайте комнату в разделе «Админка».
      </div>
    );
  }

  return (
    <div className={`chat-page${roomId ? ' has-room' : ''}`}>
      <div className="chat-rooms">
        <div className="chat-rooms-header">🏠 Комнаты</div>
        <div className="chat-rooms-list">
          {roomList.map((r) => (
            <Link
              key={r.id}
              to={`/chat/${r.id}`}
              className={`chat-room-link${roomId === r.id ? ' active' : ''}`}
            >
              {r.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="chat-main">
        <div className="chat-main-content">
          {roomId ? (
            <>
              <div className="chat-header">
                <Link to="/chat" className="chat-back touch-target" style={{ color: 'var(--accent)', textDecoration: 'none', marginRight: '0.5rem', fontSize: '1.25rem' }}>
                  ←
                </Link>
                <span style={{ flex: 1 }}>{roomList.find((r) => r.id === roomId)?.name ?? 'Чат'}</span>
              </div>
              <div className="chat-messages-wrap">
                {loading ? (
                  <div style={{ color: 'var(--text-muted)' }}>Загрузка…</div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="chat-message">
                      <div className="chat-message-header">
                        <span className="chat-message-author">{m.login}</span>
                        <span className="chat-message-time">{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                      <div className="chat-message-body">{m.body}</div>
                    </div>
                  ))
                )}
                {typing && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {typing} печатает…
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={handleSend} className="chat-form">
                <input
                  value={sendText}
                  onChange={(e) => setSendText(e.target.value)}
                  onInput={handleTyping}
                  placeholder="Сообщение…"
                />
                <button type="submit" disabled={!sendText.trim()}>
                  Отправить
                </button>
              </form>
            </>
          ) : (
            <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>
              Выберите комнату.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
