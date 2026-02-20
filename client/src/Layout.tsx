import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="layout-root">
      <aside className="layout-sidebar">
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <NavLink
            to="/chat"
            end
            style={({ isActive }) => ({
              padding: '0.5rem 1rem',
              color: isActive ? 'var(--accent)' : 'var(--text)',
              textDecoration: 'none',
            })}
          >
            Чаты
          </NavLink>
          <NavLink
            to="/profile"
            style={({ isActive }) => ({
              padding: '0.5rem 1rem',
              color: isActive ? 'var(--accent)' : 'var(--text)',
              textDecoration: 'none',
            })}
          >
            Профиль
          </NavLink>
          {(user?.role === 'owner' || user?.role === 'moderator') && (
            <NavLink
              to="/admin"
              style={({ isActive }) => ({
                padding: '0.5rem 1rem',
                color: isActive ? 'var(--accent)' : 'var(--text)',
                textDecoration: 'none',
              })}
            >
              Админка
            </NavLink>
          )}
        </nav>
        <div style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {user?.login}
          {!user?.verified && ' (ожидает верификации)'}
        </div>
      </aside>
      <main className="layout-main">
        <Outlet />
      </main>
      <nav className="layout-nav-bottom">
        <NavLink to="/chat" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Чаты
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          Профиль
        </NavLink>
        {(user?.role === 'owner' || user?.role === 'moderator') && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
            Админка
          </NavLink>
        )}
      </nav>
    </div>
  );
}
