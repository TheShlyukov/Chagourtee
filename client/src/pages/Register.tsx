import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { auth } from '../api';
import { useAuth } from '../AuthContext';

export default function Register() {
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get('invite') ?? '';
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [codeword, setCodeword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setUser, refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!inviteId) setError('Укажите инвайт в ссылке (например: /register?invite=xxx)');
  }, [inviteId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteId) return;
    setError(null);
    setLoading(true);
    try {
      const { user } = await auth.register({
        inviteId,
        login: login.trim(),
        password,
        codeword: codeword.trim() || undefined,
      });
      setUser(user);
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <h1 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Регистрация</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
              Логин
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              minLength={2}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
              Кодовое слово (опционально, для верификации владельцем)
            </label>
            <input
              type="text"
              value={codeword}
              onChange={(e) => setCodeword(e.target.value)}
              placeholder="Оставьте пустым, если не требуется"
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading || !inviteId}>
            {loading ? 'Регистрация…' : 'Зарегистрироваться'}
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}
