import { Link, useLocation } from 'react-router-dom';
import { IconAdmin, IconChat, IconSettings } from './icons/Icons';

function IsTabletNavLink({
  to,
  end,
  children,
}: {
  to: string;
  end?: boolean;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
  return (
    <Link to={to} className={isActive ? 'active' : ''}>
      {children}
    </Link>
  );
}

export type TabletBottomNavProps = { showAdmin: boolean };

/** Нижняя навигация для диапазона 678–876px (как в чате). Родитель решает, когда монтировать. */
export function TabletBottomNav({ showAdmin }: TabletBottomNavProps) {
  return (
    <nav className="tablet-nav-bottom" aria-label="Основная навигация">
      <IsTabletNavLink to="/chat" end>
        <span className="icon icon-inline">
          <IconChat />
        </span>
        <span>Чаты</span>
      </IsTabletNavLink>
      <IsTabletNavLink to="/settings">
        <span className="icon icon-inline">
          <IconSettings />
        </span>
        <span>Настройки</span>
      </IsTabletNavLink>
      {showAdmin && (
        <IsTabletNavLink to="/admin">
          <span className="icon icon-inline">
            <IconAdmin />
          </span>
          <span>Админка</span>
        </IsTabletNavLink>
      )}
    </nav>
  );
}
