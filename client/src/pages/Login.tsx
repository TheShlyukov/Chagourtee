import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useServerName } from '../ServerNameContext';
import { errorTranslations } from '../localization/errors';
import logoImage from '../assets/Images/Chagourtee_512px.png';
import Marquee from '../components/Marquee';

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
  };

  return (
    <div className="auth-page-outer">
      <div className="auth-page-inner auth-page-inner--narrow">
        <div className="auth-card">
          <div className="auth-logo-wrap">
            <img src={logoImage} alt="Chagourtee" className="auth-logo auth-logo--large" />
          </div>

          <h1 className="auth-title auth-title--display">
            <Marquee animationDuration={15}>{displayName}</Marquee>
          </h1>
          <p className="auth-tagline">{serverTagline}</p>
          <p className="auth-subtitle">Вход на сервер</p>
          <form onSubmit={handleSubmit} className="form-stack">
            <div>
              <label className="form-label">Логин</label>
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
              <label className="form-label">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="error error-margin-0">{error}</p>}
            <button type="submit" disabled={loading} className="btn-block-mt">
              {loading ? 'Вход…' : 'Войти'}
            </button>
          </form>
          <p className="auth-footer">
            Нет аккаунта? <Link to="/register">Регистрация по инвайту</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
