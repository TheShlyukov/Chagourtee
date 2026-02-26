import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login: doLogin } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await doLogin(login.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
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
        background: 'var(--gradient-bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ 
          background: 'var(--bg-elevated)', 
          borderRadius: 'var(--radius-large)', // Используем переменную
          padding: '2.5rem 2rem',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)'
        }}>
          <h1 style={{ 
            marginBottom: '0.5rem', 
            textAlign: 'center',
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '2rem',
            fontWeight: 700
          }}>Chagourtee</h1>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Рады видеть вас снова!
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Логин
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ marginTop: '0.5rem', padding: '0.75rem' }}>
              {loading ? 'Вход…' : 'Войти'}
            </button>
          </form>
          <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Нет аккаунта?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 500 }}>Регистрация по инвайту</Link>
          </p>
        </div>
      </div>
    </div>
  );
}