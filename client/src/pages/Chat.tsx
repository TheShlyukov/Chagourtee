import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Room, Message } from '../api';
import { rooms as roomsApi, messages as messagesApi } from '../api';
import { 
  getWebSocket, 
  addMessageHandler, 
  removeMessageHandler 
} from '../websocket'; // Import WebSocket manager

export default function Chat() {
  const { roomId: routeRoomId } = useParams();
  const roomId = routeRoomId ? Number(routeRoomId) : null;
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendText, setSendText] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Handle WebSocket messages related to chat
  useEffect(() => {
    if (!roomId) return;

    const handleMessage = (data: any) => {
      switch(data.type) {
        case 'message':
          if (data.message?.room_id === roomId) {
            setMessages(prev => {
              // Check if message already exists
              if (prev.some(m => m.id === data.message.id)) {
                return prev;
              }
              // Add the new message
              return [...prev, data.message];
            });
          }
          break;
          
        case 'typing':
          if (data.roomId === roomId) {
            setTyping(data.login || String(data.userId));
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setTyping(null), 3000);
          }
          break;
          
        case 'room_deleted':
          // Handle room deletion notification
          if (data.roomId === roomId) {
            // Navigate away from the deleted room
            window.location.hash = '#/chat';
            window.location.reload(); // Force refresh to update UI
          }
          break;
          
        case 'pong': // Response to heartbeat ping - handled internally
          // Connection is alive, do nothing
          break;
          
        default:
          // Handle any other message types
          break;
      }
    };

    // Add message handler when component mounts
    addMessageHandler(handleMessage);

    // Join the room if WebSocket is available
    const ws = getWebSocket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'join', roomId }));
    }

    // Cleanup function
    return () => {
      // Remove message handler when component unmounts
      removeMessageHandler(handleMessage);
      // Clear typing timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [roomId]); // Only run when roomId changes

  function handleTyping() {
    const ws = getWebSocket();
    if (ws?.readyState === WebSocket.OPEN && roomId) {
      ws.send(JSON.stringify({ type: 'typing', roomId }));
    }
  }

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
        <div className="chat-rooms-list">
          {roomList.map((r) => (
            <Link
              key={r.id}
              to={`/chat/${r.id}`}
              className={`chat-room-link${roomId === r.id ? ' active' : ''}`}
              onClick={() => {
                // Reload rooms when changing rooms to ensure latest state
                loadRooms();
              }}
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
              <div className="chat-header-desktop">
                {roomList.find((r) => r.id === roomId)?.name ?? 'Чат'}
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
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" disabled={!roomId || !sendText.trim()}>
                  <span className="send-text">Отправить</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>
            </>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Выберите чат или создайте новый
            </div>
          )}
        </div>
      </div>
    </div>
  );
}