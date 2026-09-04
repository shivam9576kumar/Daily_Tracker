import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GoogleLoginButton from './GoogleLoginButton';
import { authApi } from '../../services/authApi';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { getErrorMessage } from '../../services/api';
import './auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const toast = useUIStore((s) => s.toast);
  const [loading, setLoading] = useState(false);

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const data = await authApi.demoLogin();
      setToken(data.token);
      await fetchUser();
      navigate('/');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="gradient-text">DSA Study Planner</h1>
        <div className="login-divider" />
        <p>
          AI-powered study planning with spaced repetition,
          progress tracking, and smart scheduling.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <GoogleLoginButton />
          <button
            className="btn btn--secondary"
            onClick={handleDemoLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? 'Logging in...' : '⚡ Continue as Guest Student'}
          </button>
        </div>
      </div>
    </div>
  );
}
