import { useState, useEffect, useCallback } from 'react';
import type { Room, Invite, User } from '../api';
import { rooms as roomsApi, invites as invitesApi, verification as verificationApi, users as usersApi } from '../api';

type PendingUser = { id: number; login: string; created_at: string };
type UserWithDate = User & { created_at: string };

export default function Admin() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [users, setUsers] = useState<UserWithDate[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [inviteOpts, setInviteOpts] = useState({ maxUses: '', expiresInHours: '' });
  const [codewordCheck, setCodewordCheck] = useState<Record<number, string>>({});
  const [userCodewords, setUserCodewords] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

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
    load();
  }, [load]);

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
      await load();
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
      await navigator.clipboard.writeText(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

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

  async function setUserCodeword(userId: number) {
    const codeword = userCodewords[userId];
    if (!codeword?.trim()) return;
    setError(null);
    try {
      await usersApi.setCodeword(userId, codeword.trim());
      setMessage('Кодовое слово установлено');
      setUserCodewords((c) => ({ ...c, [userId]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function disableCodewordCheck(userId: number) {
    if (!confirm('Разрешить вход без проверки кодового слова?')) return;
    setError(null);
    try {
      await usersApi.disableCodewordCheck(userId);
      setMessage('Проверка кодового слова отключена');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

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

      <div className="card">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>👥 Управление пользователями</h3>
        {users.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Нет пользователей</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  padding: '1.25rem',
                  background: 'var(--bg-hover)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
              >
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
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      🔑 Кодовое слово
                    </label>
                    <input
                      type="text"
                      value={userCodewords[u.id] ?? ''}
                      onChange={(e) => setUserCodewords((c) => ({ ...c, [u.id]: e.target.value }))}
                      placeholder="Установить новое"
                      style={{ fontSize: '0.9rem' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setUserCodeword(u.id)}
                    disabled={!userCodewords[u.id]?.trim()}
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    ✓ Установить
                  </button>
                  {!u.verified && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => disableCodewordCheck(u.id)}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      ⏭️ Пропустить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
