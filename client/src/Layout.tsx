import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="layout-root">
      <aside className="layout-sidebar">
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 0.75rem' }}>
          <NavLink
            to="/chat"
            end
            style={({ isActive }) => ({
              padding: '0.75rem 1rem',
              color: isActive ? 'var(--accent)' : 'var(--text)',
              textDecoration: 'none',
              borderRadius: '8px',
              background: isActive ? 'var(--accent-light)' : 'transparent',
              transition: 'all 0.2s ease',
              fontWeight: isActive ? 600 : 400,
            })}
          >
            💬 Чаты
          </NavLink>
          <NavLink
            to="/profile"
            style={({ isActive }) => ({
              padding: '0.75rem 1rem',
              color: isActive ? 'var(--accent)' : 'var(--text)',
              textDecoration: 'none',
              borderRadius: '8px',
              background: isActive ? 'var(--accent-light)' : 'transparent',
              transition: 'all 0.2s ease',
              fontWeight: isActive ? 600 : 400,
            })}
          >
            👤 Профиль
          </NavLink>
          {(user?.role === 'owner' || user?.role === 'moderator') && (
            <NavLink
              to="/admin"
              style={({ isActive }) => ({
                padding: '0.75rem 1rem',
                color: isActive ? 'var(--accent)' : 'var(--text)',
                textDecoration: 'none',
                borderRadius: '8px',
                background: isActive ? 'var(--accent-light)' : 'transparent',
                transition: 'all 0.2s ease',
                fontWeight: isActive ? 600 : 400,
              })}
            >
              ⚙️ Админка
            </NavLink>
          )}
        </nav>
        <div style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 'auto', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>{user?.login}</div>
          {!user?.verified && <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>⏳ Ожидает верификации</div>}
        </div>
      </aside>
      <main className="layout-main">
        <Outlet />
      </main>
      <nav className="layout-nav-bottom">
        <NavLink to="/chat" end className={({ isActive }) => (isActive ? 'active' : '')}>
          💬 Чаты
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          👤 Профиль
        </NavLink>
        {(user?.role === 'owner' || user?.role === 'moderator') && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
            ⚙️ Админка
          </NavLink>
        )}
      </nav>
    </div>
  );
}
