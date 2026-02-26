import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { auth, verification } from '../api';
import { useAuth } from '../AuthContext';

export default function Register() {
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get('invite') ?? '';
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [codeword, setCodeword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationEnabled, setVerificationEnabled] = useState(false);
  const { setUser, refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Load verification settings
    verification.settings()
      .then(data => setVerificationEnabled(!!data.enabled))
      .catch(err => console.error('Failed to load verification settings:', err));

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
        codeword: codeword.trim() || undefined, // Still send undefined if not required
      });
      setUser(user);
      await refresh();
      // If verification is enabled and user has to wait, show a different message
      if (verificationEnabled && !user.verified) {
        navigate('/profile', { replace: true }); // Go to profile where user can see verification status
      } else {
        navigate('/', { replace: true });
      }
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
        background: 'var(--gradient-bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
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
          }}>Регистрация</h1>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Создайте аккаунт по инвайту
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
                minLength={2}
                placeholder="Минимум 2 символа"
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
                autoComplete="new-password"
                minLength={6}
                placeholder="Минимум 6 символов"
                required
              />
            </div>
            {verificationEnabled && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  Кодовое слово <span style={{ color: 'var(--text-danger)', fontWeight: 400 }}>(обязательно)</span>
                </label>
                <input
                  type="text"
                  value={codeword}
                  onChange={(e) => setCodeword(e.target.value)}
                  placeholder="Для верификации владельцем"
                  required={verificationEnabled}
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: 0 }}>
                  Это кодовое слово будет использовано для вашей верификации. Убедитесь, что знаете его.
                </p>
              </div>
            )}
            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading || !inviteId} style={{ marginTop: '0.5rem', padding: '0.75rem' }}>
              {loading ? 'Регистрация…' : 'Зарегистрироваться'}
            </button>
          </form>
          <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Уже есть аккаунт?{' '}
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Войти</Link>
          </p>
        </div>
      </div>
    </div>
  );
}