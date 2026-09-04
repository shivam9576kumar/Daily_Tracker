import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { tokenStorage } from '../../services/tokenStorage';
import ThemeToggle from '../common/ThemeToggle';
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
  { to: '/study-slots', label: 'My Classes', end: false },
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
    <header className="navbar topbar">
      <NavLink to="/" end className="navbar__brand" aria-label="DSA Planner — home">
        <span className="navbar__brand-a">DSA</span>{' '}
        <span className="navbar__brand-b">Planner</span>
      </NavLink>

      <nav className="navbar__links topbar-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `navbar__link nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="navbar__right">
        <ThemeToggle />
        {user?.avatarUrl ? (
          <img
            className="navbar__avatar"
            src={user.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="navbar__avatar">{initial}</div>
        )}
        <span className="navbar__user">{user?.name || user?.email || ''}</span>
        <button className="navbar__logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

