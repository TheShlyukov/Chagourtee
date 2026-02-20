import { useState, useEffect, useCallback } from 'react';
import type { Room, Invite } from '../api';
import { rooms as roomsApi, invites as invitesApi, verification as verificationApi } from '../api';

type PendingUser = { id: number; login: string; created_at: string };

export default function Admin() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [inviteOpts, setInviteOpts] = useState({ maxUses: '', expiresInHours: '' });
  const [codewordCheck, setCodewordCheck] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [rRes, iRes, pRes] = await Promise.all([
        roomsApi.list(),
        invitesApi.list(),
        verificationApi.pending(),
      ]);
      setRooms(rRes.rooms);
      setInvites(iRes.invites);
      setPending(pRes.pending);
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

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Админка</h2>
      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}
      {message && <p style={{ color: 'var(--success)', marginBottom: '1rem' }}>{message}</p>}

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Комнаты</h3>
        <form onSubmit={createRoom} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Название комнаты"
            style={{ maxWidth: 280 }}
          />
          <button type="submit">Создать</button>
        </form>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rooms.map((r) => (
            <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span>{r.name}</span>
              <button type="button" className="secondary" onClick={() => deleteRoom(r.id)}>
                Удалить
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Инвайты</h3>
        <form onSubmit={createInvite} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input
            type="number"
            min={1}
            value={inviteOpts.maxUses}
            onChange={(e) => setInviteOpts((o) => ({ ...o, maxUses: e.target.value }))}
            placeholder="Макс. использований"
            style={{ width: 160 }}
          />
          <input
            type="number"
            min={1}
            value={inviteOpts.expiresInHours}
            onChange={(e) => setInviteOpts((o) => ({ ...o, expiresInHours: e.target.value }))}
            placeholder="Срок (часы)"
            style={{ width: 120 }}
          />
          <button type="submit">Создать инвайт</button>
        </form>
        {lastInviteUrl && (
          <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
            Ссылка для приглашения: <a href={lastInviteUrl} target="_blank" rel="noreferrer">{lastInviteUrl}</a>
            {import.meta.env.VITE_APP_PUBLIC_URL && ' (по настройке VITE_APP_PUBLIC_URL)'}
          </p>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {invites.map((inv) => (
            <li key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
              <code style={{ background: 'var(--bg-hover)', padding: '0.2rem 0.4rem' }}>{inv.id}</code>
              <span style={{ color: 'var(--text-muted)' }}>
                {inv.uses_count}{inv.max_uses != null ? `/${inv.max_uses}` : ''} · {inv.expires_at ? new Date(inv.expires_at).toLocaleString() : 'без срока'}
              </span>
              <button type="button" className="secondary" onClick={() => deleteInvite(inv.id)}>
                Удалить
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 style={{ marginBottom: '0.75rem' }}>Верификация (ожидают)</h3>
        {pending.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Нет пользователей на верификации.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {pending.map((u) => (
              <li
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span>{u.login}</span>
                <input
                  type="text"
                  value={codewordCheck[u.id] ?? ''}
                  onChange={(e) => setCodewordCheck((c) => ({ ...c, [u.id]: e.target.value }))}
                  placeholder="Кодовое слово для проверки"
                  style={{ width: 200 }}
                />
                <button type="button" className="secondary" onClick={() => checkCodeword(u.id)}>
                  Проверить
                </button>
                <button type="button" onClick={() => approve(u.id)}>Подтвердить</button>
                <button type="button" className="danger" onClick={() => reject(u.id)}>
                  Отклонить
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
