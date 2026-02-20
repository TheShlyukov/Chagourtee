const BASE = '';

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

export const verification = {
  pending: () =>
    api<{ pending: { id: number; login: string; created_at: string }[] }>(
      '/api/verification/pending'
    ),
  check: (userId: number, codeword: string) =>
    api<{ match: boolean; message?: string }>('/api/verification/check', {
      method: 'POST',
      body: JSON.stringify({ userId, codeword }),
    }),
  approve: (userId: number) =>
    api<{ ok: boolean }>('/api/verification/approve', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  reject: (userId: number) =>
    api<{ ok: boolean }>('/api/verification/reject', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};

export const profile = {
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ ok: boolean }>('/api/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    }),
  changeLogin: (password: string, newLogin: string) =>
    api<{ ok: boolean; login?: string }>('/api/profile/change-login', {
      method: 'POST',
      body: JSON.stringify({ password, newLogin }),
    }),
  submitCodeword: (codeword: string) =>
    api<{ ok: boolean; message?: string }>('/api/profile/codeword', {
      method: 'POST',
      body: JSON.stringify({ codeword }),
    }),
};
