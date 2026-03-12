import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useServerName } from '../ServerNameContext';
import { errorTranslations } from '../localization/errors';
import logoImage from '../assets/Images/Chagourtee_512px.png'; // Import the logo
import Marquee from '../components/Marquee'; // Import Marquee component

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login: doLogin } = useAuth();
  const navigate = useNavigate();
  const { displayName, serverTagline } = useServerName();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await doLogin(login.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка входа';
      const translatedError = errorTranslations[errorMessage] || errorMessage;
      setError(translatedError);
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
          {/* Logo added above the form */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <img 
              src={logoImage} 
              alt="Chagourtee" 
              style={{ 
                maxWidth: '120px', 
                height: 'auto',
                display: 'block',
                margin: '0 auto'
              }} 
            />
          </div>
          
          <h1 style={{ 
            marginBottom: '0.25rem', 
            textAlign: 'center',
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '2rem',
            fontWeight: 700,
            overflow: 'hidden',
            maxWidth: '100%'
          }}>
            <Marquee animationDuration={15}>
              {displayName}
            </Marquee>
          </h1>
          <p style={{ 
            textAlign: 'center', 
            color: 'var(--text-secondary)', 
            marginBottom: '1rem', 
            fontSize: '0.9rem',
            fontStyle: 'italic'
          }}>
            {serverTagline}
          </p>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Вход на сервер
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Логин
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value.slice(0, 32))}
                autoComplete="username"
                minLength={2}
                maxLength={32}
                pattern="[a-zA-Z0-9]{2,32}"
                title="Логин должен содержать от 2 до 32 символов, только латинские буквы и цифры"
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