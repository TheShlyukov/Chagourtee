import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import type { Room, Invite, User, MediaStorageSettings } from '../api';
import { rooms as roomsApi, invites as invitesApi, verification as verificationApi, users as usersApi, serverSettings as serverSettingsApi, media } from '../api';
import { useServerName } from '../ServerNameContext';
import { initializeWebSocket, addMessageHandler, removeMessageHandler } from '../websocket';
import { useToast } from '../ToastContext';
import { errorTranslations } from '../localization/errors';

// Function to translate error messages
function translateErrorMessage(errorMsg: string): string {
  return errorTranslations[errorMsg] || errorMsg;
}

function formatBytes(value: number): string {
  if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${value} B`;
}

type PendingUser = { id: number; login: string; created_at: string; };
type UserWithDate = User & { created_at: string; };

export default function Admin() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [users, setUsers] = useState<UserWithDate[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [inviteOpts, setInviteOpts] = useState({ maxUses: '', expiresInHours: '' });
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [verificationEnabled, setVerificationEnabled] = useState(false);
  const [codes, setCodes] = useState<{id: number, created_by_login: string, used: number, created_at: string, expires_at: string}[]>([]);
  const [customCode, setCustomCode] = useState<string>('');
  const { rawName, displayName, setRawNameLocal } = useServerName();
  const [serverNameInput, setServerNameInput] = useState<string>(rawName ?? '');
  const [serverNameSaving, setServerNameSaving] = useState(false);
  const [mediaStorageSettings, setMediaStorageSettings] = useState<MediaStorageSettings | null>(null);
  const [storageLimitInput, setStorageLimitInput] = useState<string>('-1');
  const [storageCleanupStrategy, setStorageCleanupStrategy] = useState<'block' | 'delete_oldest'>('block');
  const [storageSettingsSaving, setStorageSettingsSaving] = useState(false);
  
  // State for renaming
  const [renamingRoomId, setRenamingRoomId] = useState<number | null>(null);
  const [renamingInputValue, setRenamingInputValue] = useState(''); // Separate state for renaming

  const load = useCallback(async () => {
    try {
      // Load invites for everyone
      const iRes = await invitesApi.list();
      setInvites(iRes.invites);
      
      // Load other data only for owners
      if (user?.role === 'owner') {
        const [rRes, pRes, uRes] = await Promise.all([
          roomsApi.list(),
          verificationApi.pending(),
          usersApi.list(),
        ]);
        setRooms(rRes.rooms);
        setPending(pRes.pending);
        setUsers(uRes.users);
      }
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка загрузки', 'error');
    }
  }, [user, showToast]);

  useEffect(() => {
    setServerNameInput(rawName ?? '');
  }, [rawName]);

  useEffect(() => {
    if (user?.role !== 'owner' && user?.role !== 'moderator') return;
    
    // Load verification settings only for owners
    if (user.role === 'owner') {
      verificationApi.settings()
        .then(data => setVerificationEnabled(!!data.enabled))
        .catch(err => DEBUG_MODE && console.error('Error fetching verification settings:', err));

      media.getStorageSettings()
        .then((data) => {
          setMediaStorageSettings(data);
          setStorageCleanupStrategy(data.cleanupStrategy);
          setStorageLimitInput(
            data.maxStorageSize === null || data.maxStorageSize === undefined
              ? '-1'
              : String(data.maxStorageSize)
          );
        })
        .catch((err) => DEBUG_MODE && console.error('Error loading media storage settings:', err));
      
      // Load users
      usersApi.list().then((data) => {
        setUsers(data.users);
      }).catch(err => DEBUG_MODE && console.error('Error loading users:', err));
      
      // Load pending verifications
      verificationApi.pending().then((data) => {
        setPending(data.pending);
      }).catch(err => DEBUG_MODE && console.error('Error loading pending verifications:', err));
      
      // Load verification codes
      verificationApi.listCodes().then((data) => {
        setCodes(data.codes);
      }).catch(err => DEBUG_MODE && console.error('Error loading verification codes:', err));
    }

    load();
  }, [user, load]);

  // WebSocket realtime updates for admin data
  useEffect(() => {
    if (!user || (user.role !== 'owner' && user.role !== 'moderator')) return;

    const handleWsMessage = (data: any) => {
      switch (data.type) {
        case 'room_created':
          if (user.role === 'owner' && data.room) {
            setRooms(prev => {
              if (prev.some(r => r.id === data.room.id)) return prev;
              return [...prev, data.room];
            });
          }
          break;

        case 'room_updated':
          if (user.role === 'owner' && data.room) {
            setRooms(prev =>
              prev.map(r => (r.id === data.room.id ? { ...r, ...data.room } : r))
            );
          }
          break;

        case 'room_deleted':
          if (user.role === 'owner' && typeof data.roomId === 'number') {
            setRooms(prev => prev.filter(r => r.id !== data.roomId));
          }
          break;

        case 'room_messages_cleared':
          // Админке не нужно состояние сообщений по комнатам, можно игнорировать
          break;

        case 'admin_invites_updated':
          // Перезагружаем только инвайты
          invitesApi.list()
            .then(res => setInvites(res.invites))
            .catch(() => {});
          break;

        case 'admin_verification_codes_updated':
          if (user.role === 'owner') {
            verificationApi.listCodes()
              .then(res => setCodes(res.codes))
              .catch(() => {});
          }
          break;

        case 'verification_settings_updated':
          if (user.role === 'owner') {
            // Новое поле settings предпочтительно, но поддерживаем и enabled
            const enabled = typeof data.enabled === 'boolean'
              ? data.enabled
              : !!data.settings?.enabled;
            setVerificationEnabled(enabled);
          }
          break;

        case 'user_role_changed':
        case 'user_updated':
        case 'user_verification_changed':
        case 'user_deleted_admin':
          if (user.role === 'owner') {
            // Обновляем список пользователей и ожидающих
            usersApi.list()
              .then(res => setUsers(res.users))
              .catch(() => {});
            verificationApi.pending()
              .then(res => setPending(res.pending))
              .catch(() => {});
          }
          break;

        case 'user_verified':
        case 'user_rejected':
          if (user.role === 'owner') {
            // Эти события уже приходят конкретному пользователю, но для админки обновим списки
            usersApi.list()
              .then(res => setUsers(res.users))
              .catch(() => {});
            verificationApi.pending()
              .then(res => setPending(res.pending))
              .catch(() => {});
          }
          break;

        case 'server_settings_updated':
          if (user.role === 'owner' && data.settings) {
            const name = data.settings.server_name ?? null;
            setRawNameLocal(name);
            setServerNameInput(name ?? '');
          }
          break;

        default:
          break;
      }
    };

    initializeWebSocket();
    addMessageHandler(handleWsMessage);

    return () => {
      removeMessageHandler(handleWsMessage);
    };
  }, [user, setRawNameLocal]);

  // Helper function for copying text to clipboard with fallback
  const copyToClipboard = async (text: string) => {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not supported');
      }
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        const successful = document.execCommand('copy');
        if (!successful) {
          throw new Error('Fallback copy failed');
        }
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
        throw fallbackErr;
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  // Functions for invites (available to both owners and moderators)
  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      const inv = await invitesApi.create({
        maxUses: inviteOpts.maxUses ? Number(inviteOpts.maxUses) : undefined,
        expiresInHours: inviteOpts.expiresInHours ? Number(inviteOpts.expiresInHours) : undefined,
      });
      await load();
      const baseUrl = import.meta.env.VITE_APP_PUBLIC_URL || location.origin;
      const url = `${baseUrl.replace(/\/$/, '')}/register?invite=${inv.id}`;
      setLastInviteUrl(url);
      showToast('Инвайт создан. Ссылка скопирована в буфер.', 'success');

      // Use the new copyToClipboard helper
      await copyToClipboard(url);
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка', 'error');
    }
  }


  async function deleteInvite(id: string) {
    try {
      await invitesApi.delete(id);
      await load();
      showToast('Инвайт удалён', 'success');
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка', 'error');
    }
  }

  // Functions for other sections (only for owners)
  async function createRoom(e: React.FormEvent) {
    if (user?.role !== 'owner') {
      showToast('Только владелец может создавать комнаты', 'error');
      return;
    }
    
    e.preventDefault();
    const trimmedName = newRoomName.trim();
    
    if (!trimmedName) {
      showToast('Введите название комнаты', 'error');
      return;
    }
    
    if (trimmedName.length > 32) {
      showToast('Название комнаты не может превышать 32 символа', 'error');
      return;
    }
    
    try {
      await roomsApi.create(trimmedName);
      setNewRoomName('');
      showToast('Комната создана', 'success');
      // Обновление будет происходить через WebSocket, так что не нужно вызывать load() здесь
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка', 'error');
    }
  }

  async function saveServerName(e: React.FormEvent) {
    if (user?.role !== 'owner') {
      showToast('Только владелец может изменять имя сервера', 'error');
      return;
    }
    
    e.preventDefault();
    const trimmed = serverNameInput.trim();
    
    // Apply 32 character limit
    if (trimmed.length > 32) {
      showToast('Имя сервера слишком длинное (максимум 32 символа)', 'error');
      return;
    }
    
    setServerNameSaving(true);
    try {
      const res = await serverSettingsApi.update(trimmed);
      setRawNameLocal(res.server_name ?? null);
      showToast('Имя сервера обновлено', 'success');
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка при сохранении имени сервера', 'error');
    } finally {
      setServerNameSaving(false);
    }
  }

  async function saveMediaStorageSettings(e: React.FormEvent) {
    e.preventDefault();
    if (user?.role !== 'owner') {
      showToast('Только владелец может изменять настройки хранилища', 'error');
      return;
    }

    const parsedLimit = Number(storageLimitInput);
    if (!Number.isFinite(parsedLimit) || parsedLimit < -1) {
      showToast('Лимит хранилища должен быть -1 или числом >= 0', 'error');
      return;
    }

    setStorageSettingsSaving(true);
    try {
      const normalizedLimit = parsedLimit === -1 ? null : parsedLimit;
      const saved = await media.updateStorageSettings({
        maxStorageSize: normalizedLimit,
        cleanupStrategy: storageCleanupStrategy,
      });
      setMediaStorageSettings(saved);
      setStorageLimitInput(saved.maxStorageSize === null ? '-1' : String(saved.maxStorageSize));
      showToast('Настройки медиа-хранилища обновлены', 'success');
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка сохранения', 'error');
    } finally {
      setStorageSettingsSaving(false);
    }
  }

  async function deleteRoom(id: number) {
    if (user?.role !== 'owner') {
      showToast('Только владелец может удалять комнаты', 'error');
      return;
    }
    
    if (!confirm('Удалить комнату и все сообщения?')) return;
    try {
      await roomsApi.delete(id);
      showToast('Комната удалена', 'success');
      // Обновление будет происходить через WebSocket, так что не нужно вызывать load() здесь
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка', 'error');
    }
  }

  async function clearRoomMessages(id: number) {
    if (user?.role !== 'owner') {
      showToast('Только владелец может очищать сообщения в комнатах', 'error');
      return;
    }
    
    if (!confirm('Очистить все сообщения в комнате?')) return;
    try {
      await roomsApi.clearMessages(id);
      showToast('Сообщения в комнате очищены', 'success');
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка', 'error');
    }
  }

  async function approve(userId: number) {
    if (user?.role !== 'owner') {
      showToast('Только владелец может верифицировать пользователей', 'error');
      return;
    }
    
    try {
      // Using the correct API endpoint for approving users
      await usersApi.disableCodewordCheck(userId);
      showToast('Пользователь верифицирован', 'success');
      // Обновление будет происходить через WebSocket, так что не нужно вызывать load() здесь
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка', 'error');
    }
  }

  async function reject(userId: number) {
    if (user?.role !== 'owner') {
      showToast('Только владелец может отклонять пользователей', 'error');
      return;
    }
    
    if (!confirm('Отклонить и удалить пользователя?')) return;
    try {
      // Rejecting by deleting the user with a rejection reason
      await usersApi.delete(userId, 'Ваша заявка на верификацию была отклонена');
      showToast('Пользователь отклонён', 'success');
      // Обновление будет происходить через WebSocket, так что не нужно вызывать load() здесь
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка', 'error');
    }
  }

  async function changeUserRole(userId: number, role: 'owner' | 'moderator' | 'member') {
    if (user?.role !== 'owner') {
      showToast('Только владелец может изменять роли пользователей', 'error');
      return;
    }
    
    try {
      await usersApi.changeRole(userId, role);
      showToast('Роль изменена', 'success');
      // Обновление будет происходить через WebSocket, так что не нужно вызывать load() здесь
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка', 'error');
    }
  }

  const toggleVerification = async () => {
    if (user?.role !== 'owner') {
      showToast('Только владелец может изменять настройки верификации', 'error');
      return;
    }
    
    try {
      const response = await verificationApi.updateSettings(!verificationEnabled);
      setVerificationEnabled(response.enabled);
      showToast(`Система верификации ${response.enabled ? 'включена' : 'отключена'}`, 'success');
    } catch (error) {
      DEBUG_MODE && console.error('Failed to toggle verification:', error);
      showToast('Ошибка при изменении настроек верификации', 'error');
    }
  };

  const approveUser = async (userId: number) => {
    if (user?.role !== 'owner') {
      showToast('Только владелец может верифицировать пользователей', 'error');
      return;
    }
    
    try {
      // Using the correct API endpoint for approving users
      await usersApi.disableCodewordCheck(userId);
      showToast('Пользователь верифицирован', 'success');
      // Обновление будет происходить через WebSocket, так что не нужно вызывать load() здесь
    } catch (error) {
      DEBUG_MODE && console.error('Failed to approve user:', error);
      showToast('Ошибка при подтверждении пользователя', 'error');
    }
  };

  const rejectUser = async (userId: number) => {
    if (user?.role !== 'owner') {
      showToast('Только владелец может отклонять пользователей', 'error');
      return;
    }
    
    try {
      // Rejecting by deleting the user with a rejection reason
      await usersApi.delete(userId, 'Ваша заявка на верификацию была отклонена');
      showToast('Пользователь отклонён', 'success');
      // Обновление будет происходить через WebSocket, так что не нужно вызывать load() здесь
    } catch (error) {
      DEBUG_MODE && console.error('Failed to reject user:', error);
      showToast('Ошибка при отклонении пользователя', 'error');
    }
  };

  const createVerificationCode = async () => {
    if (user?.role !== 'owner') {
      showToast('Только владелец может создавать коды верификации', 'error');
      return;
    }
    
    try {
      // Fixed: only pass the customCode as the single argument
      const newCode = await verificationApi.createCode(customCode || undefined);
      
      // Creating a temporary object with all the fields for the UI
      const fullCode = {
        id: newCode.id,
        created_by_login: "Вы", // Placeholder - in real app, we'd fetch this info separately
        used: 0,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString() // Expires in 7 days
      };
      setCodes([fullCode, ...codes]);

      // Use the new copyToClipboard helper
      await copyToClipboard(newCode.code);

      setCustomCode(''); // Очищаем поле ввода после успешного создания
      showToast('Код верификации создан и скопирован в буфер', 'success');
    } catch (error) {
      DEBUG_MODE && console.error('Failed to create verification code:', error);
      showToast('Ошибка при создании кода: ' + (error as Error).message, 'error');
    }
  };


  const deleteVerificationCode = async (id: number) => {
    if (user?.role !== 'owner') {
      showToast('Только владелец может удалять коды верификации', 'error');
      return;
    }
    
    try {
      await verificationApi.deleteCode(id);
      setCodes(codes.filter(code => code.id !== id));
      showToast('Код удален', 'success');
    } catch (error) {
      DEBUG_MODE && console.error('Failed to delete verification code:', error);
      showToast('Ошибка при удалении кода', 'error');
    }
  };

  // Add a new state for tracking the reason for deletion
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [deletionReason, setDeletionReason] = useState<string>('Account removed by administrator');

  // Add a new function to handle user deletion with reason
  const handleDeleteUserWithReason = async (userId: number) => {
    if (user?.role !== 'owner') {
      showToast('Только владелец может удалять пользователей', 'error');
      return;
    }
    
    setDeletingUserId(userId);
    setDeletionReason('Account removed by administrator'); // Reset to default reason
  };

  // Add a new function to confirm user deletion with reason
  const confirmDeleteUser = async () => {
    if (user?.role !== 'owner') {
      showToast('Только владелец может удалять пользователей', 'error');
      setDeletingUserId(null);
      return;
    }
    
    if (deletingUserId !== null) {
      if (!window.confirm(`Вы уверены, что хотите удалить пользователя? Причина: ${deletionReason}`)) {
        setDeletingUserId(null);
        return;
      }
      
      try {
        await usersApi.delete(deletingUserId, deletionReason);
        await refreshUsers();
        showToast('Пользователь удален', 'success');
      } catch (err) {
        showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка при удалении пользователя', 'error');
      } finally {
        setDeletingUserId(null);
        setDeletionReason('');
      }
    }
  };

  // Add a new function to refresh users list
  const refreshUsers = async () => {
    if (user?.role !== 'owner') {
      showToast('Только владелец может обновлять список пользователей', 'error');
      return;
    }
    
    try {
      const uRes = await usersApi.list();
      setUsers(uRes.users);
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка загрузки', 'error');
    }
  };

  async function renameRoom(id: number, name: string) {
    if (user?.role !== 'owner') {
      showToast('Только владелец может переименовывать комнаты', 'error');
      return;
    }
    
    if (!name.trim()) {
      showToast('Введите название комнаты', 'error');
      return;
    }
    
    if (name.length > 32) {
      showToast('Название комнаты не может превышать 32 символа', 'error');
      return;
    }
    
    try {
      await roomsApi.update(id, name.trim());
      showToast('Комната переименована', 'success');
      setRenamingRoomId(null);
      setRenamingInputValue(''); // Reset renaming input value
      // Обновление будет происходить через WebSocket, так что не нужно вызывать load() здесь
    } catch (err) {
      showToast(err instanceof Error ? translateErrorMessage(err.message) : 'Ошибка', 'error');
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      {/* Invites section - available to both owners and moderators */}
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
            borderRadius: 'var(--radius-medium)', // Используем переменную
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

      {/* Only show the rest of the admin panel to owners */}
      {user?.role === 'owner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>🖥 Имя сервера</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Текущее отображение: <strong>{displayName}</strong>
            </p>
            <form onSubmit={saveServerName} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                value={serverNameInput}
                onChange={(e) => setServerNameInput(e.target.value.slice(0, 32))}
                placeholder="Например: Мой сервер"
                maxLength={32}
              />
              <button type="submit" disabled={serverNameSaving} style={{ alignSelf: 'flex-start', paddingInline: '1.25rem' }}>
                {serverNameSaving ? 'Сохранение…' : 'Сохранить имя сервера'}
              </button>
            </form>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Пример: <strong>Мой сервер</strong>
            </p>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>💾 Медиа-хранилище</h3>
            <form onSubmit={saveMediaStorageSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Лимит хранилища в байтах (`-1` = без ограничений)
                </span>
                <input
                  type="number"
                  min={-1}
                  step={1}
                  value={storageLimitInput}
                  onChange={(e) => setStorageLimitInput(e.target.value)}
                  placeholder="-1"
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Политика при превышении квоты</span>
                <select
                  value={storageCleanupStrategy}
                  onChange={(e) => setStorageCleanupStrategy(e.target.value as 'block' | 'delete_oldest')}
                >
                  <option value="block">block (блокировать новые загрузки)</option>
                  <option value="delete_oldest">delete_oldest (удалять самые старые файлы)</option>
                </select>
              </label>

              <button type="submit" disabled={storageSettingsSaving} style={{ alignSelf: 'flex-start', paddingInline: '1.25rem' }}>
                {storageSettingsSaving ? 'Сохранение…' : 'Сохранить настройки хранилища'}
              </button>
            </form>

            {mediaStorageSettings && (
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Использовано: {formatBytes(mediaStorageSettings.totalBytes)} ({mediaStorageSettings.filesCount} файлов)
              </p>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>🏠 Комнаты</h3>
            <form onSubmit={createRoom} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value.slice(0, 32))}
                placeholder="Название комнаты (макс. 32 символа)"
                style={{ flex: '1 1 200px', minWidth: 0 }}
                maxLength={32}
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
                    borderRadius: 'var(--radius-medium)', // Используем переменную
                    border: '1px solid var(--border)',
                    flexWrap: 'wrap'
                  }}>
                    {renamingRoomId === r.id ? (
                      <>
                        <input
                          type="text"
                          value={renamingInputValue}
                          onChange={(e) => setRenamingInputValue(e.target.value.slice(0, 32))}
                          placeholder="Новое название комнаты"
                          maxLength={32}
                          autoFocus
                          style={{ 
                            flex: '1 1 150px', 
                            fontWeight: 500, 
                            wordBreak: 'break-word',
                            marginRight: '0.5rem'
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              renameRoom(r.id, renamingInputValue);
                            } else if (e.key === 'Escape') {
                              setRenamingRoomId(null);
                              setRenamingInputValue('');
                            }
                          }}
                        />
                        <button 
                          type="button" 
                          onClick={() => renameRoom(r.id, renamingInputValue)}
                          style={{ 
                            fontSize: '0.875rem', 
                            flex: '0 0 auto',
                            backgroundColor: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-default)',
                            padding: '0.25rem 0.5rem',
                            cursor: 'pointer',
                            marginRight: '0.25rem'
                          }}
                        >
                          ✅ Сохранить
                        </button>
                        <button 
                          type="button" 
                          onClick={() => {
                            setRenamingRoomId(null);
                            setRenamingInputValue('');
                          }}
                          style={{ 
                            fontSize: '0.875rem', 
                            flex: '0 0 auto',
                            backgroundColor: 'var(--danger)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-default)',
                            padding: '0.25rem 0.5rem',
                            cursor: 'pointer'
                          }}
                        >
                          ❌ Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: '1 1 150px', fontWeight: 500, wordBreak: 'break-word' }}>{r.name}</span>
                        {r.name === 'main' ? (
                          <button 
                            type="button" 
                            onClick={() => clearRoomMessages(r.id)} 
                            style={{ 
                              fontSize: '0.875rem', 
                              flex: '0 0 auto',
                              backgroundColor: 'var(--warning)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-default)', // Используем переменную
                              padding: '0.25rem 0.5rem',
                              cursor: 'pointer'
                            }}
                          >
                            🧹 Очистить
                          </button>
                        ) : (
                          <>
                            <button 
                              type="button" 
                              onClick={() => {
                                setRenamingRoomId(r.id);
                                setRenamingInputValue(r.name); // Set the current name as the initial value for renaming
                              }} 
                              style={{ 
                                fontSize: '0.875rem', 
                                flex: '0 0 auto',
                                backgroundColor: 'var(--accent)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius-default)',
                                padding: '0.25rem 0.5rem',
                                cursor: 'pointer',
                                marginRight: '0.25rem'
                              }}
                            >
                              ✏️ Переименовать
                            </button>
                            <button 
                              type="button" 
                              className="danger" 
                              onClick={() => deleteRoom(r.id)} 
                              style={{ fontSize: '0.875rem', flex: '0 0 auto' }}
                            >
                              🗑️ Удалить
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sections only for owners */}
      {user?.role === 'owner' && (
        <>
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
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
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
                          onClick={() => handleDeleteUserWithReason(u.id)}
                          style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                        >
                          🗑️ Удалить
                        </button>
                      )}
                    </div>
                    
                    {/* Verification controls only for unverified members */}
                    {!u.verified && u.role === 'member' && verificationEnabled && (
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => approveUser(u.id)} style={{ flex: '1 1 auto', fontSize: '0.875rem', minWidth: '100px' }}>
                          ✓ Подтвердить
                        </button>
                        <button type="button" className="danger" onClick={() => rejectUser(u.id)} style={{ flex: '1 1 auto', fontSize: '0.875rem', minWidth: '100px' }}>
                          ✕ Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Add the modal for deletion reason if needed */}
      {deletingUserId !== null && user?.role === 'owner' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-elevated)',
            padding: '1.5rem',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Причина удаления</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Укажите причину удаления:
              </label>
              <textarea
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-input)',
                  minHeight: '80px'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setDeletingUserId(null)}
                style={{ padding: '0.5rem 1rem' }}
              >
                Отмена
              </button>
              <button 
                onClick={confirmDeleteUser}
                className="danger"
                style={{ padding: '0.5rem 1rem' }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DEBUG_MODE = import.meta.env.DEV || false;