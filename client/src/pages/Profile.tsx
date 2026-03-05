import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { profile } from '../api';
import Marquee from '../components/Marquee'; // Import Marquee component

export default function Profile() {
  const { user, refresh, logout } = useAuth();
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

  const handleLogout = async () => {
    if (window.confirm('Вы уверены, что хотите выйти?')) {
      try {
        await logout();
        window.location.href = '/login'; // Redirect to login page after logout
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };

  // Function to get role display name
  const getRoleDisplayName = (role: string) => {
    switch(role) {
      case 'owner':
        return 'Владелец';
      case 'moderator':
        return 'Модератор';
      case 'member':
        return 'Участник';
      default:
        return role;
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Logout section at the top */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>🚪 Выйти из аккаунта</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Вы вошли как <strong><Marquee>{user?.login}</Marquee></strong>
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Роль: <strong>
                <span className="user-role-label">
                  {getRoleDisplayName(user?.role || '')}
                </span>
              </strong>
            </p>
            <button 
              onClick={handleLogout}
              className="danger"
              style={{ 
                alignSelf: 'flex-start', 
                backgroundColor: 'var(--danger)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius-default)',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Выйти
            </button>
          </div>
        </div>

        {!user?.verified && (
          <div className="card" style={{ borderLeft: '4px solid var(--danger)', gridColumn: '1 / -1' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1.2rem'}}>⏳ Ожидание верификации</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Ваш аккаунт ожидает подтверждения от владельца сервера. 
              Как только администратор подтвердит вашу учетную запись, вы получите доступ ко всем функциям.
            </p>
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
                onChange={(e) => setLoginNew(e.target.value.slice(0, 32))}
                placeholder="Минимум 2 символа"
                minLength={2}
                maxLength={32}
                pattern="[a-zA-Z0-9]{2,32}"
                title="Логин должен содержать от 2 до 32 символов, только латинские буквы и цифры"
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