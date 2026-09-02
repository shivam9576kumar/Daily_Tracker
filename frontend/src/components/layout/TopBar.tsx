import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { tokenStorage } from '../../services/tokenStorage';
import './topbar.css';

/**
 * `end: true` on "/" means: active ONLY when pathname is exactly "/".
 * Without it, "/" matches every route (because every path starts with "/").
 * Other links use prefix matching, so "/roadmap/week/2" still highlights Roadmap.
 */
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/roadmap', label: 'Roadmap', end: false },
  { to: '/progress', label: 'Progress', end: false },
  { to: '/study-slots', label: 'Study Slots', end: false },
  { to: '/generate-plan', label: 'Generate Plan', end: false },
];

export default function TopBar() {
  const user = useAuthStore((s) => s.user);

  const handleLogout = () => {
    tokenStorage.clear();
    window.location.href = '/login'; // full reload also wipes in-memory stores
  };

  const initial = (user?.name?.trim()?.[0] || user?.email?.[0] || '?').toUpperCase();

  return (
    <header className="topbar">
      <NavLink to="/" end className="topbar-logo">
        DSA Planner
      </NavLink>

      <nav className="topbar-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="topbar-user">
        {user?.avatarUrl ? (
          <img
            className="topbar-avatar"
            src={user.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="topbar-avatar topbar-avatar-fallback">{initial}</div>
        )}
        <span className="topbar-name">{user?.name || user?.email || ''}</span>
        <button className="topbar-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
