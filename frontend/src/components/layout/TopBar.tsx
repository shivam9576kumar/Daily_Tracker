import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { tokenStorage } from '../../services/tokenStorage';
import ThemeToggle from '../common/ThemeToggle';
import './topbar.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/roadmap', label: 'Roadmap', end: false },
  { to: '/progress', label: 'Progress', end: false },
  { to: '/study-slots', label: 'My Classes', end: false },
  { to: '/generate-plan', label: 'Generate Plan', end: false },
];

export default function TopBar() {
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Lock body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleLogout = () => {
    tokenStorage.clear();
    window.location.href = '/login';
  };

  const initial = (user?.name?.trim()?.[0] || user?.email?.[0] || '?').toUpperCase();

  return (
    <header className="navbar topbar">
      <NavLink to="/" end className="navbar__brand" aria-label="DSA Planner — home">
        <span className="navbar__brand-a">DSA</span>{' '}
        <span className="navbar__brand-b">Planner</span>
      </NavLink>

      {/* Desktop links */}
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

      {/* Desktop right */}
      <div className="navbar__right">
        <ThemeToggle />
        {user?.avatarUrl ? (
          <img className="navbar__avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="navbar__avatar">{initial}</div>
        )}
        <span className="navbar__user">{user?.name || user?.email || ''}</span>
        <button className="navbar__logout" onClick={handleLogout}>Logout</button>
      </div>

      {/* Mobile: theme toggle + hamburger */}
      <div className="navbar__mobile">
        <ThemeToggle />
        <button
          type="button"
          className="navbar__hamburger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={`hamburger-icon${menuOpen ? ' is-open' : ''}`}>
            <span /><span /><span />
          </span>
        </button>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
          <nav className="mobile-menu" onClick={(e) => e.stopPropagation()} aria-label="Mobile navigation">
            <div className="mobile-menu__user">
              {user?.avatarUrl ? (
                <img className="navbar__avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="navbar__avatar">{initial}</div>
              )}
              <div className="mobile-menu__user-text">
                <span className="mobile-menu__user-name">{user?.name || 'Student'}</span>
                {user?.email && <span className="mobile-menu__user-email">{user.email}</span>}
              </div>
            </div>

            <div className="mobile-menu__links">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `mobile-menu__link${isActive ? ' active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            <button className="mobile-menu__logout" onClick={handleLogout}>Logout</button>
          </nav>
        </div>
      )}
    </header>
  );
}
