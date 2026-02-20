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
  const [codeword, setCodeword] = useState('');
  const [codewordError, setCodewordError] = useState<string | null>(null);
  const [codewordOk, setCodewordOk] = useState(false);

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

  async function handleCodeword(e: React.FormEvent) {
    e.preventDefault();
    if (!codeword.trim()) return;
    setCodewordError(null);
    try {
      await profile.submitCodeword(codeword);
      setCodewordOk(true);
      setCodeword('');
      await refresh();
    } catch (err) {
      setCodewordError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: 480 }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Профиль</h2>
      {user && (
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Логин: <strong>{user.login}</strong> · Роль: {user.role}
        </p>
      )}

      {!user?.verified && (
        <section style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Кодовое слово</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Введите кодовое слово для верификации. Владелец сервера проверит его вручную.
          </p>
          <form onSubmit={handleCodeword} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 320 }}>
            <input
              value={codeword}
              onChange={(e) => setCodeword(e.target.value)}
              placeholder="Кодовое слово"
            />
            {codewordError && <p className="error">{codewordError}</p>}
            {codewordOk && <p style={{ color: 'var(--success)' }}>Отправлено. Ожидайте подтверждения.</p>}
            <button type="submit" disabled={!codeword.trim()}>
              Отправить
            </button>
          </form>
        </section>
      )}

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Сменить пароль</h3>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 320 }}>
          <input
            type="password"
            value={passCurrent}
            onChange={(e) => setPassCurrent(e.target.value)}
            placeholder="Текущий пароль"
            required
          />
          <input
            type="password"
            value={passNew}
            onChange={(e) => setPassNew(e.target.value)}
            placeholder="Новый пароль"
            minLength={6}
            required
          />
          {passError && <p className="error">{passError}</p>}
          {passOk && <p style={{ color: 'var(--success)' }}>Пароль изменён.</p>}
          <button type="submit">Сохранить</button>
        </form>
      </section>

      <section>
        <h3 style={{ marginBottom: '0.75rem' }}>Сменить логин</h3>
        <form onSubmit={handleChangeLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 320 }}>
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="Пароль"
            required
          />
          <input
            type="text"
            value={loginNew}
            onChange={(e) => setLoginNew(e.target.value)}
            placeholder="Новый логин"
            minLength={2}
            required
          />
          {loginError && <p className="error">{loginError}</p>}
          {loginOk && <p style={{ color: 'var(--success)' }}>Логин изменён.</p>}
          <button type="submit">Сохранить</button>
        </form>
      </section>
    </div>
  );
}
