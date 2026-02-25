import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { profile } from '../api';

export default function Profile() {
  const { user, refresh } = useAuth();
  const [passCurrent, setPassCurrent] = useState('');
  const [passNew, setPassNew] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passOk, setPassOk] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginNew, setLoginNew] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginOk, setLoginOk] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassError(null);
    try {
      await profile.changePassword(passCurrent, passNew);
      setPassOk(true);
      setPassCurrent('');
      setPassNew('');
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleChangeLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      await profile.changeLogin(loginPassword, loginNew);
      setLoginOk(true);
      setLoginPassword('');
      setLoginNew('');
      await refresh();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  const [codewordValue, setCodewordValue] = useState('');
  const [codewordError, setCodewordError] = useState<string | null>(null);
  const [codewordSuccess, setCodewordSuccess] = useState<string | null>(null);
  const [codewordSubmitting, setCodewordSubmitting] = useState(false);

  async function handleCodewordSubmit() {
    setCodewordError(null);
    setCodewordSuccess(null);
    setCodewordSubmitting(true);
    try {
      await profile.submitCodeword(codewordValue);
      setCodewordSuccess('Кодовое слово отправлено! Ожидайте верификации от владельца.');
      setCodewordValue('');
    } catch (err) {
      setCodewordError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setCodewordSubmitting(false);
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {!user?.verified && (
          <div className="card" style={{ borderLeft: '4px solid var(--danger)', gridColumn: '1 / -1' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1.2rem'}}>⏳ Ожидание верификации</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Ваш аккаунт ожидает подтверждения от владельца сервера. 
            </p>
            
            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Кодовое слово для верификации
              </label>
              <input
                type="text"
                value={codewordValue}
                onChange={(e) => setCodewordValue(e.target.value)}
                placeholder="Введите кодовое слово"
                style={{ width: '100%', marginBottom: '0.5rem' }}
              />
              {codewordError && <p className="error" style={{ margin: 0 }}>{codewordError}</p>}
              {codewordSuccess && <p style={{ color: 'var(--success)', margin: 0 }}>{codewordSuccess}</p>}
              <button 
                onClick={handleCodewordSubmit}
                style={{ marginTop: '0.5rem' }}
                disabled={codewordSubmitting}
              >
                {codewordSubmitting ? 'Отправка...' : 'Отправить кодовое слово'}
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>🔒 Сменить пароль</h3>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Текущий пароль
              </label>
              <input
                type="password"
                value={passCurrent}
                onChange={(e) => setPassCurrent(e.target.value)}
                placeholder="Введите текущий пароль"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Новый пароль
              </label>
              <input
                type="password"
                value={passNew}
                onChange={(e) => setPassNew(e.target.value)}
                placeholder="Минимум 6 символов"
                minLength={6}
                required
              />
            </div>
            {passError && <p className="error" style={{ margin: 0 }}>{passError}</p>}
            {passOk && <p style={{ color: 'var(--success)', margin: 0 }}>✓ Пароль изменён.</p>}
            <button type="submit" style={{ alignSelf: 'flex-start' }}>Сохранить</button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>✏️ Сменить логин</h3>
          <form onSubmit={handleChangeLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Пароль
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Подтвердите паролем"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                Новый логин
              </label>
              <input
                type="text"
                value={loginNew}
                onChange={(e) => setLoginNew(e.target.value)}
                placeholder="Минимум 2 символа"
                minLength={2}
                required
              />
            </div>
            {loginError && <p className="error" style={{ margin: 0 }}>{loginError}</p>}
            {loginOk && <p style={{ color: 'var(--success)', margin: 0 }}>✓ Логин изменён.</p>}
            <button type="submit" style={{ alignSelf: 'flex-start' }}>Сохранить</button>
          </form>
        </div>
      </div>
    </div>
  );
}