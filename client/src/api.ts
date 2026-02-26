const BASE = '';

export type VersionInfo = {
  version: string;
  name: string;
  release: string;
};

export type User = {
  id: number;
  login: string;
  role: 'owner' | 'moderator' | 'member';
  verified: boolean;
};

export type Room = {
  id: number;
  name: string;
  created_at: string;
  message_count?: number;
};

export type Message = {
  id: number;
  room_id: number;
  user_id: number;
  body: string;
  created_at: string;
  updated_at?: string; // Optional field for when message was last updated
  login: string;
};

export type Invite = {
  id: string;
  created_by: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  created_at: string;
};

export type ServerSettings = {
  name: string | null;
};

export async function api<T>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(res.ok ? text : `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const auth = {
  me: () => api<User>('/api/auth/me'),
  login: (login: string, password: string) =>
    api<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),
  logout: () => api<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  register: (body: {
    inviteId?: string;
    login: string;
    password: string;
    codeword?: string;
    bootstrap?: string;
  }) =>
    api<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const rooms = {
  list: () => api<{ rooms: Room[] }>('/api/rooms'),
  create: (name: string) =>
    api<Room>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  update: (id: number, name: string) =>
    api<Room>(`/api/rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  delete: (id: number) =>
    api<{ ok: boolean }>(`/api/rooms/${id}`, { method: 'DELETE' }),
  clearMessages: (id: number) =>
    api<{ ok: boolean, message: string }>(`/api/rooms/${id}/messages`, { method: 'DELETE' }),
};

export const messages = {
  list: (roomId: number, params?: { limit?: number; before?: number }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.before) sp.set('before', String(params.before));
    const q = sp.toString();
    return api<{ messages: Message[] }>(
      `/api/rooms/${roomId}/messages${q ? `?${q}` : ''}`
    );
  },
  send: (roomId: number, body: string) =>
    api<Message>(`/api/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  edit: (messageId: number, roomId: number, body: string) =>
    api<Message>(`/api/rooms/${roomId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    }),
  delete: (messageId: number, roomId: number) =>
    api<{ ok: boolean }>(`/api/rooms/${roomId}/messages/${messageId}`, { 
      method: 'DELETE' 
    }),
  deleteMultiple: (roomId: number, messageIds: number[]) =>
    api<{ ok: boolean, count: number }>(`/api/rooms/${roomId}/messages/batch-delete`, {
      method: 'DELETE',
      body: JSON.stringify({ messageIds }),
    }),
};

export const invites = {
  list: () => api<{ invites: Invite[] }>('/api/invites'),
  create: (opts?: { maxUses?: number; expiresInHours?: number }) =>
    api<Invite>('/api/invites', {
      method: 'POST',
      body: JSON.stringify(opts || {}),
    }),
  delete: (id: string) =>
    api<{ ok: boolean }>(`/api/invites/${id}`, { method: 'DELETE' }),
};

export const serverSettings = {
  get: () => api<ServerSettings>('/api/server/settings'),
  update: (name: string) =>
    api<ServerSettings>('/api/server/settings', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
};

export const serverVersion = {
  get: () => api<VersionInfo>('/api/version'),
};

export const verification = {
  settings: () => api<{ enabled: boolean }>('/api/verification/settings'),
  updateSettings: (enabled: boolean) => 
    api<{ ok: boolean, enabled: boolean }>('/api/verification/settings', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
  pending: () => api<{ pending: { id: number; login: string; created_at: string }[] }>('/api/verification/pending'),
  listCodes: () => 
    api<{ codes: {id: number, created_by_login: string, used: number, created_at: string, expires_at: string}[] }>('/api/verification/codes'),
  createCode: (customCode?: string) => 
    api<{ code: string, id: number }>('/api/verification/codes', {
      method: 'POST',
      body: JSON.stringify({ customCode }),
    }),
  updateCode: (id: number, expiration: string) => 
    api<{ ok: boolean }>('/api/verification/codes/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ expiration }),
    }),
  useCode: (code: string) => 
    api<{ ok: boolean }>('/api/verification/codes/use', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  deleteCode: (id: number) => 
    api<{ ok: boolean }>('/api/verification/codes/' + id, {
      method: 'DELETE',
    }),
};

export const users = {
  list: () =>
    api<{ users: (User & { created_at: string })[] }>('/api/users'),
  changeRole: (userId: number, role: 'owner' | 'moderator' | 'member') =>
    api<{ ok: boolean }>(`/api/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  delete: (userId: number, reason?: string) =>
    api<{ ok: boolean }>(`/api/users/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),
  setCodeword: (userId: number, codeword: string) =>
    api<{ ok: boolean }>(`/api/users/${userId}/codeword`, {
      method: 'PATCH',
      body: JSON.stringify({ codeword }),
    }),
  disableCodewordCheck: (userId: number) =>
    api<{ ok: boolean }>(`/api/users/${userId}/disable-codeword-check`, {
      method: 'POST',
    }),
};

export const profile = {
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ ok: boolean }>('/api/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  changeLogin: (password: string, newLogin: string) =>
    api<{ ok: boolean, login: string }>('/api/profile/change-login', {
      method: 'POST',
      body: JSON.stringify({ password, newLogin }),
    }),
  setCodeword: (codeword: string) =>
    api<{ ok: boolean, message: string }>('/api/profile/codeword', {
      method: 'POST',
      body: JSON.stringify({ codeword }),
    }),
};

// Export WebSocket related functions
export { 
  getWebSocket, 
  addMessageHandler, 
  removeMessageHandler,
  isWebSocketConnected,
  addOpenHandler,
  removeOpenHandler
} from './websocket';