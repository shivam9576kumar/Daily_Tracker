import { useAuthStore } from '../../store/authStore';
import './layout.css';

export default function TopBar() {
  const { user, logout } = useAuthStore();

  return (
    <header className="topbar" id="topbar">
      <div className="topbar-left">
        <h2 className="topbar-logo gradient-text">DSA Planner</h2>
      </div>

      <nav className="topbar-nav">
        <a href="/" className="topbar-link active">Dashboard</a>
        <a href="/roadmap" className="topbar-link">Roadmap</a>
        <a href="/progress" className="topbar-link">Progress</a>
        <a href="/study-slots" className="topbar-link">Study Slots</a>
        <a href="/generate-plan" className="topbar-link">Generate Plan</a>
      </nav>

      <div className="topbar-right">
        {user && (
          <div className="topbar-user">
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="topbar-avatar"
              />
            )}
            <span className="topbar-name">{user.name}</span>
            <button className="topbar-logout" onClick={logout} id="logout-btn">
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
