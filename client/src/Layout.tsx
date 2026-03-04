import { Outlet, NavLink, useLocation, useParams, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useState, useEffect } from 'react';
import { rooms as roomsApi } from './api';
import { useServerName } from './ServerNameContext';
import Marquee from './components/Marquee'; // Import Marquee component
import { useUserListPanel } from './UserListPanelContext';

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const params = useParams();
  const [roomName, setRoomName] = useState<string | null>(null);
  const { displayName, serverTagline } = useServerName();
  const { toggle: toggleUserList } = useUserListPanel();
  
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Check if we're in a specific chat room
  const isInSpecificRoom = location.pathname.startsWith('/chat/') && params.roomId;

  // Update mobile state when window resizes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    
    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Загрузка названия комнаты для заголовка
  useEffect(() => {
    const roomId = params.roomId ? Number(params.roomId) : null;
    if (roomId) {
      roomsApi.list().then(({ rooms }) => {
        const room = rooms.find(r => r.id === roomId);
        setRoomName(room?.name || null);
      }).catch(() => setRoomName(null));
    } else {
      setRoomName(null);
    }
  }, [params.roomId]);

  // Определяем заголовок для текущей страницы
  const getPageTitle = () => {
    if (location.pathname.startsWith('/chat')) {
      if (params.roomId && roomName) return roomName;
      return '🏠 Комнаты';
    }
    if (location.pathname === '/profile') return '👤 Профиль';
    if (location.pathname === '/admin') return '⚙️ Админка';
    return 'Chagourtee';
  };

  const showBackButton = location.pathname.startsWith('/chat/') && params.roomId;

  return (
    <div className="layout-root">
      <nav className="layout-header-top">
        {showBackButton && (
          <Link to="/chat" className="chat-back touch-target" style={{ color: 'var(--accent)', textDecoration: 'none', marginRight: '0.5rem', fontSize: '1.25rem' }}>
            ←
          </Link>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span>{getPageTitle()}</span>
          {/* Conditionally render server name and tagline only if not on mobile in a specific room */}
          {!(isMobile && isInSpecificRoom) ? (
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <Marquee animationDuration={15}>
                  {displayName}
                </Marquee>
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  marginLeft: '0.5rem',
                }}
              >
                {serverTagline}
              </span>
            </div>
          ) : (
            <div></div> // Empty div to maintain layout spacing
          )}
        </div>
        {location.pathname.startsWith('/chat/') && (
          <button
            type="button"
            className="layout-users-button secondary"
            onClick={toggleUserList}
          >
            👥
          </button>
        )}
      </nav>
      <aside className="layout-sidebar">
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 0.75rem' }}>
          <NavLink
            to="/chat"
            end
            style={({ isActive }) => ({
              padding: '0.75rem 1rem',
              color: isActive ? 'var(--accent)' : 'var(--text)',
              textDecoration: 'none',
              borderRadius: 'var(--radius-medium)', // Используем переменную
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
              borderRadius: 'var(--radius-medium)', // Используем переменную
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
                borderRadius: 'var(--radius-medium)', // Используем переменную
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
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
            <Marquee animationDuration={10}>
              {user?.login}
            </Marquee>
          </div>
          {!user?.verified && <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>⏳ Ожидает верификации</div>}
          <div
            style={{
              fontSize: '0.8rem',
              marginTop: '0.35rem',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <Marquee>
              {displayName}
            </Marquee>
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              marginTop: '0.35rem',
              color: 'var(--text-muted)',
            }}
          >
            {serverTagline}
          </div>
        </div>
      </aside>
      <main className="layout-main">
        <Outlet />
      </main>
      {location.pathname.startsWith('/chat/') ? null : (
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
      )}
    </div>
  );
}