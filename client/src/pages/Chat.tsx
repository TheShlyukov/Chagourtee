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
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

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
    
    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const connectWebSocket = () => {
      const ws = new WebSocket(`${WS_BASE}/ws`);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
        ws.send(JSON.stringify({ type: 'join', roomId }));
      };
      
      ws.onmessage = (event) => {
        // Force the browser to process the message immediately
        Promise.resolve().then(async () => {
          try {
            const data = JSON.parse(event.data);
            
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
                
              default:
                // Handle any other message types
                break;
            }
          } catch (parseError) {
            console.warn('Failed to parse WebSocket message:', event.data, parseError);
          }
        }).catch((err) => {
          console.warn('WS message handling error (recovered):', err);
        });
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        
        // Attempt to reconnect unless closed intentionally
        if (event.code !== 4001 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          // Exponential backoff for reconnection
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
        }
      };
    };
    
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [roomId, loadRooms]); // Added loadRooms to dependency array to trigger reload when needed

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
                />
                <button type="submit" disabled={!sendText.trim()} aria-label="Отправить">
                  <span style={{ display: 'inline-block', fontSize: '1.1rem' }}>📤</span>
                  <span style={{ marginLeft: '0.5rem' }} className="send-text">Отправить</span>
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