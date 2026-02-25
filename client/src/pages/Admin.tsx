import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../AuthContext';
import type { Room, Invite, User } from '../api';
import { rooms as roomsApi, invites as invitesApi, verification as verificationApi, users as usersApi } from '../api';

type PendingUser = { id: number; login: string; created_at: string };
type UserWithDate = User & { created_at: string };

export default function Admin() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [users, setUsers] = useState<UserWithDate[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [inviteOpts, setInviteOpts] = useState({ maxUses: '', expiresInHours: '' });
  const [codewordCheck, setCodewordCheck] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [verificationEnabled, setVerificationEnabled] = useState(false);
  const [codes, setCodes] = useState<{id: number, created_by_login: string, used: number, created_at: string, expires_at: string}[]>([]);
  const [customCode, setCustomCode] = useState<string>('');
  
  const load = useCallback(async () => {
    try {
      const [rRes, iRes, pRes, uRes] = await Promise.all([
        roomsApi.list(),
        invitesApi.list(),
        verificationApi.pending(),
        usersApi.list(),
      ]);
      setRooms(rRes.rooms);
      setInvites(iRes.invites);
      setPending(pRes.pending);
      setUsers(uRes.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'owner' && user?.role !== 'moderator') return;
    
    // Load verification settings
    verificationApi.settings()
      .then(data => setVerificationEnabled(!!data.enabled))
      .catch(console.error);
    
    // Load users
    usersApi.list().then((data) => {
      setUsers(data.users);
    }).catch(console.error);
    
    // Load pending verifications
    verificationApi.pending().then((data) => {
      setPending(data.pending);
    }).catch(console.error);
    
    // Load verification codes
    verificationApi.listCodes().then((data) => {
      setCodes(data.codes);
    }).catch(console.error);

    load();
  }, [user, load]);

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setError(null);
    try {
      await roomsApi.create(newRoomName.trim());
      setNewRoomName('');
      await load();
      setMessage('Комната создана');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function deleteRoom(id: number) {
    if (!confirm('Удалить комнату и все сообщения?')) return;
    setError(null);
    try {
      await roomsApi.delete(id);
      // Instead of just reloading, we'll update the state directly
      setRooms(prev => prev.filter(room => room.id !== id));
      setMessage('Комната удалена');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const inv = await invitesApi.create({
        maxUses: inviteOpts.maxUses ? Number(inviteOpts.maxUses) : undefined,
        expiresInHours: inviteOpts.expiresInHours ? Number(inviteOpts.expiresInHours) : undefined,
      });
      await load();
      const baseUrl = import.meta.env.VITE_APP_PUBLIC_URL || location.origin;
      const url = `${baseUrl.replace(/\/$/, '')}/register?invite=${inv.id}`;
      setLastInviteUrl(url);
      setMessage('Инвайт создан. Ссылка скопирована в буфер.');

      // Проверяем наличие API clipboard и безопасного контекста
      if (navigator && navigator.clipboard && 'writeText' in navigator.clipboard && window.isSecureContext) {
        // Попытка скопировать в буфер обмена
        navigator.clipboard.writeText(url)
          .then(() => {
            setMessage('Инвайт создан. Ссылка скопирована в буфер.');
          })
          .catch(err => {
            console.error('Failed to copy invite link to clipboard: ', err);
            // Показываем пользователю инструкции по ручному копированию
            createInviteDisplayAndCopyPrompt(url);
          });
      } else {
        // Альтернативный метод копирования
        createInviteDisplayAndCopyPrompt(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  // Вспомогательная функция для отображения ссылки инвайта и запроса на копирование
  const createInviteDisplayAndCopyPrompt = (url: string) => {
    // Показываем пользователю, что ссылка создана
    setMessage('Инвайт создан. Для копирования нажмите Ctrl+C или Cmd+C.');
    
    // Создаем временный элемент для выделения текста
    const textArea = document.createElement("textarea");
    textArea.value = url;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    
    // Выделяем и копируем текст
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setMessage('Инвайт создан. Ссылка скопирована в буфер.');
      } else {
        setMessage('Инвайт создан. Для копирования нажмите Ctrl+C или Cmd+C.');
      }
    } catch (err) {
      console.error('Fallback: Could not copy invite link', err);
      setMessage('Инвайт создан. Пожалуйста, скопируйте ссылку вручную.');
    } finally {
      document.body.removeChild(textArea);
    }
  };

  async function deleteInvite(id: string) {
    setError(null);
    try {
      await invitesApi.delete(id);
      await load();
      setMessage('Инвайт удалён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function checkCodeword(userId: number) {
    const word = codewordCheck[userId];
    if (word === undefined || word === '') return;
    try {
      const res = await verificationApi.check(userId, word);
      setMessage(res.match ? 'Кодовое слово совпало' : 'Не совпало');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function approve(userId: number) {
    setError(null);
    try {
      await verificationApi.approve(userId);
      setMessage('Пользователь верифицирован');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function reject(userId: number) {
    if (!confirm('Отклонить и удалить пользователя?')) return;
    setError(null);
    try {
      await verificationApi.reject(userId);
      setMessage('Пользователь отклонён');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function changeUserRole(userId: number, role: 'owner' | 'moderator' | 'member') {
    setError(null);
    try {
      await usersApi.changeRole(userId, role);
      setMessage('Роль изменена');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function deleteUser(userId: number) {
    if (!confirm('Удалить пользователя?')) return;
    setError(null);
    try {
      await usersApi.delete(userId);
      setMessage('Пользователь удалён');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  const toggleVerification = async () => {
    try {
      const response = await verificationApi.updateSettings(!verificationEnabled);
      setVerificationEnabled(response.enabled);
      setMessage(`Система верификации ${response.enabled ? 'включена' : 'отключена'}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to toggle verification:', error);
      alert('Ошибка при изменении настроек верификации');
    }
  };

  const verifyCodeword = async (userId: number, codeword: string) => {
    try {
      const response = await verificationApi.check(userId, codeword);
      setMessage(response.match ? 'Кодовое слово совпало' : 'Кодовое слово не совпало');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to verify codeword:', error);
      alert('Ошибка при проверке кодового слова');
    }
  };

  const approveUser = async (userId: number) => {
    try {
      await verificationApi.approve(userId);
      setMessage('Пользователь верифицирован');
      await load();
    } catch (error) {
      console.error('Failed to approve user:', error);
      alert('Ошибка при подтверждении пользователя');
    }
  };

  const rejectUser = async (userId: number) => {
    try {
      await verificationApi.reject(userId);
      setMessage('Пользователь отклонён');
      await load();
    } catch (error) {
      console.error('Failed to reject user:', error);
      alert('Ошибка при отклонении пользователя');
    }
  };

  const createVerificationCode = async () => {
    try {
      const newCode = await verificationApi.createCode(undefined, customCode || undefined);
      // Fix for the type mismatch - ensure the newCode object has all required properties
      const fullCode = {
        id: newCode.id,
        created_by_login: "Вы", // Placeholder - in real app, we'd fetch this info separately
        used: 0,
        created_at: new Date().toISOString(),
        expires_at: newCode.expires_at
      };
      setCodes([fullCode, ...codes]);

      // Проверяем наличие API clipboard и безопасного контекста
      if (navigator && navigator.clipboard && 'writeText' in navigator.clipboard && window.isSecureContext) {
        // Попытка скопировать в буфер обмена
        navigator.clipboard.writeText(newCode.code)
          .then(() => {
            setMessage(`Новый код создан: ${newCode.code} и скопирован в буфер обмена!`);
          })
          .catch(err => {
            console.error('Failed to copy code to clipboard: ', err);
            // Показываем код пользователю даже если копирование не удалось
            createCodeDisplayAndCopyPrompt(newCode.code);
          });
      } else {
        // Альтернативный метод копирования
        createCodeDisplayAndCopyPrompt(newCode.code);
      }

      setCustomCode(''); // Очищаем поле ввода после успешного создания
      setTimeout(() => setMessage(''), 15000); // Показываем сообщение 15 секунд
    } catch (error) {
      console.error('Failed to create verification code:', error);
      alert('Ошибка при создании кода: ' + (error as Error).message);
    }
  };

  // Вспомогательная функция для отображения кода и запроса на копирование
  const createCodeDisplayAndCopyPrompt = (code: string) => {
    // Показываем код и инструкции пользователю
    setMessage(`Новый код создан: ${code}. Нажмите Ctrl+C или Cmd+C для копирования.`);
    
    // Создаем временный элемент для выделения текста
    const textArea = document.createElement("textarea");
    textArea.value = code;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    
    // Выделяем и копируем текст
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setMessage(`Новый код создан: ${code} и скопирован в буфер обмена!`);
      } else {
        setMessage(`Новый код создан: ${code}. Нажмите Ctrl+C или Cmd+C для копирования.`);
      }
    } catch (err) {
      console.error('Fallback: Could not copy text', err);
      setMessage(`Новый код создан: ${code}. Пожалуйста, скопируйте его вручную.`);
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const deleteVerificationCode = async (id: number) => {
    try {
      await verificationApi.deleteCode(id);
      setCodes(codes.filter(code => code.id !== id));
      setMessage('Код удален');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to delete verification code:', error);
      alert('Ошибка при удалении кода');
    }
  };

  const codewordInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      {error && (
        <div style={{ 
          padding: '1rem 1.25rem', 
          marginBottom: '1.5rem', 
          background: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid var(--danger)',
          borderRadius: '8px',
          color: 'var(--danger)'
        }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ 
          padding: '1rem 1.25rem', 
          marginBottom: '1.5rem', 
          background: 'rgba(16, 185, 129, 0.1)', 
          border: '1px solid var(--success)',
          borderRadius: '8px',
          color: 'var(--success)'
        }}>
          ✓ {message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>🏠 Комнаты</h3>
          <form onSubmit={createRoom} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Название комнаты"
              style={{ flex: '1 1 200px', minWidth: 0 }}
            />
            <button type="submit" style={{ flex: '0 0 auto' }}>➕ Создать</button>
          </form>
          {rooms.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Нет комнат</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {rooms.map((r) => (
                <div key={r.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  background: 'var(--bg-hover)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ flex: '1 1 150px', fontWeight: 500, wordBreak: 'break-word' }}>{r.name}</span>
                  <button type="button" className="danger" onClick={() => deleteRoom(r.id)} style={{ fontSize: '0.875rem', flex: '0 0 auto' }}>
                    🗑️ Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>🎫 Инвайты</h3>
          <form onSubmit={createInvite} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <input
              type="number"
              min={1}
              value={inviteOpts.maxUses}
              onChange={(e) => setInviteOpts((o) => ({ ...o, maxUses: e.target.value }))}
              placeholder="Макс. использований (необязательно)"
            />
            <input
              type="number"
              min={1}
              value={inviteOpts.expiresInHours}
              onChange={(e) => setInviteOpts((o) => ({ ...o, expiresInHours: e.target.value }))}
              placeholder="Срок в часах (необязательно)"
            />
            <button type="submit" style={{ width: '100%' }}>➕ Создать инвайт</button>
          </form>
          {lastInviteUrl && (
            <div style={{ 
              marginBottom: '1.5rem', 
              padding: '1rem',
              background: 'var(--accent-light)',
              borderRadius: '8px',
              border: '1px solid var(--accent)'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Ссылка для приглашения:</div>
              <a href={lastInviteUrl} target="_blank" rel="noreferrer" style={{ 
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                color: 'var(--accent)',
                fontWeight: 500,
                fontSize: '0.9rem'
              }}>{lastInviteUrl}</a>
              {import.meta.env.VITE_APP_PUBLIC_URL && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  ℹ️ По настройке VITE_APP_PUBLIC_URL
                </div>
              )}
            </div>
          )}
          {invites.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Нет активных инвайтов</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {invites.map((inv) => (
                <div key={inv.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  background: 'var(--bg-hover)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  flexWrap: 'wrap'
                }}>
                  <code style={{ 
                    background: 'var(--bg)', 
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 600,
                    color: 'var(--accent)'
                  }}>{inv.id}</code>
                  <span style={{ color: 'var(--text-muted)', flex: '1 1 150px', fontSize: '0.85rem' }}>
                    {inv.uses_count}{inv.max_uses != null ? `/${inv.max_uses}` : ''} · {inv.expires_at ? new Date(inv.expires_at).toLocaleString() : 'без срока'}
                  </span>
                  <button type="button" className="danger" onClick={() => deleteInvite(inv.id)} style={{ fontSize: '0.875rem', flex: '0 0 auto' }}>
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>✅ Верификация (ожидают)</h3>
        {pending.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Нет пользователей на верификации</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pending.map((u) => (
              <div
                key={u.id}
                style={{
                  padding: '1.25rem',
                  background: 'var(--bg-hover)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ marginBottom: '1rem', fontWeight: 600, fontSize: '1.05rem' }}>
                  👤 {u.login}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input
                    type="text"
                    value={codewordCheck[u.id] ?? ''}
                    onChange={(e) => setCodewordCheck((c) => ({ ...c, [u.id]: e.target.value }))}
                    placeholder="Кодовое слово для проверки"
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
                    <button type="button" className="secondary" onClick={() => checkCodeword(u.id)} style={{ flex: '1 1 auto', fontSize: '0.875rem', minWidth: '100px' }}>
                      🔍 Проверить
                    </button>
                    <button type="button" onClick={() => approve(u.id)} style={{ flex: '1 1 auto', fontSize: '0.875rem', minWidth: '100px' }}>
                      ✓ Подтвердить
                    </button>
                    <button type="button" className="danger" onClick={() => reject(u.id)} style={{ flex: '1 1 auto', fontSize: '0.875rem', minWidth: '100px' }}>
                      ✕ Отклонить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card for verification settings */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>🔐 Настройка верификации</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <span style={{ flex: 1 }}>
            {verificationEnabled 
              ? '✅ Система верификации включена' 
              : '❌ Система верификации отключена'}
          </span>
          <button 
            type="button" 
            onClick={toggleVerification}
            className={verificationEnabled ? 'danger' : ''}
            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          >
            {verificationEnabled ? '❌ Отключить' : '✅ Включить'}
          </button>
        </div>
        
        {verificationEnabled && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-hover)', borderRadius: '6px' }}>
            <p style={{ margin: 0, marginBottom: '0.75rem' }}>
              При включенной системе все новые пользователи будут ожидать верификации.
            </p>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Вы можете использовать одноразовые коды для автоматической верификации или 
              проверять кодовые слова вручную для пользователей.
            </p>
          </div>
        )}
      </div>

      {/* Card for verification codes if verification is enabled */}
      {verificationEnabled && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>🔢 Одноразовые коды верификации</h3>
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="Введите свой код (необязательно)"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                marginBottom: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)'
              }}
            />
            <button 
              type="button" 
              onClick={createVerificationCode}
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
            >
              ➕ Создать одноразовый код
            </button>
          </div>
          
          {codes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Нет активных кодов</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {codes.map((code) => (
                <div 
                  key={code.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '0.75rem', 
                    backgroundColor: 'var(--bg-card)', 
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold' }}>ID: {code.id}</div>
                    <div style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>
                      Создан: {new Date(code.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>Статус: {code.used ? 'Использован' : 'Доступен'}</div>
                    <div style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>
                      Срок до: {new Date(code.expires_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Удалить этот код?')) {
                        deleteVerificationCode(code.id);
                      }
                    }}
                    style={{
                      marginLeft: '0.5rem',
                      padding: '0.25rem 0.5rem',
                      border: 'none',
                      backgroundColor: 'var(--danger)',
                      color: 'white',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer'
                    }}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Card for users management */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>👥 Пользователи</h3>
        {users.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Нет пользователей</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {users.map((u) => (
              <div key={u.id} style={{ 
                padding: '1rem', 
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border)',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
                      {u.login}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {u.verified ? '✓ Верифицирован' : '⏳ Ожидает'}
                    </div>
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) => changeUserRole(u.id, e.target.value as 'owner' | 'moderator' | 'member')}
                    disabled={u.role === 'owner'}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontSize: '0.9rem',
                      minWidth: '120px'
                    }}
                  >
                    <option value="owner">Владелец</option>
                    <option value="moderator">Модератор</option>
                    <option value="member">Участник</option>
                  </select>
                  {u.role !== 'owner' && (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => deleteUser(u.id)}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      🗑️ Удалить
                    </button>
                  )}
                </div>
                
                {/* Verification controls only for unverified members */}
                {!u.verified && u.role === 'member' && verificationEnabled && (
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      ref={codewordInputRef}
                      placeholder="Введите кодовое слово"
                      style={{ flex: '1 1 200px', fontSize: '0.9rem' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          codewordInputRef.current?.value && verifyCodeword(u.id, codewordInputRef.current.value);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (codewordInputRef.current?.value) {
                          verifyCodeword(u.id, codewordInputRef.current.value);
                        }
                      }}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      ✅ Проверить
                    </button>
                    <button
                      type="button"
                      onClick={() => approveUser(u.id)}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', backgroundColor: 'var(--success)' }}
                    >
                      ✓ Подтвердить
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => rejectUser(u.id)}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      ❌ Отклонить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
}