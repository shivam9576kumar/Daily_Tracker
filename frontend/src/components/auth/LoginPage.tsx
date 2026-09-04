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
      {/* ── Left Panel — Branding + Features ── */}
      <div className="login-hero">
        <div className="login-hero__brand">
          <span className="login-hero__brand-a">DSA</span>
          <span className="login-hero__brand-b">Planner</span>
        </div>

        <h1 className="login-hero__tagline">
          Master DSA with AI-Powered Study Plans
        </h1>
        <p className="login-hero__subtitle">
          Intelligent scheduling, spaced repetition, and real-time progress
          tracking — all in one place.
        </p>

        <ul className="login-features">
          <li>
            <div className="login-features__icon">🤖</div>
            <div className="login-features__text">
              <span className="login-features__title">AI-Powered Planning</span>
              <span className="login-features__desc">
                Chat with AI to build a personalized study plan in seconds
              </span>
            </div>
          </li>
          <li>
            <div className="login-features__icon">📅</div>
            <div className="login-features__text">
              <span className="login-features__title">Smart Scheduling</span>
              <span className="login-features__desc">
                Weighted topic distribution with spaced repetition built in
              </span>
            </div>
          </li>
          <li>
            <div className="login-features__icon">📊</div>
            <div className="login-features__text">
              <span className="login-features__title">Progress Tracking</span>
              <span className="login-features__desc">
                Heatmaps, streaks, and detailed analytics to keep you motivated
              </span>
            </div>
          </li>
          <li>
            <div className="login-features__icon">🎯</div>
            <div className="login-features__text">
              <span className="login-features__title">Revision Engine</span>
              <span className="login-features__desc">
                Automatic revision scheduling based on your difficulty ratings
              </span>
            </div>
          </li>
        </ul>
      </div>

      {/* ── Right Panel — Auth Card ── */}
      <div className="login-form-panel">
        <div className="login-card">
          <h2 className="login-card__heading">Get Started</h2>
          <p className="login-card__subtext">
            Sign in to start your study plan
          </p>
          <div className="login-divider" />

          <div className="login-actions">
            <GoogleLoginButton />

            <div className="login-or">
              <span>or</span>
            </div>

            <button
              className="login-guest-btn"
              onClick={handleDemoLogin}
              disabled={loading}
              id="guest-login-btn"
            >
              {loading ? 'Logging in…' : '⚡ Continue as Guest Student'}
            </button>
          </div>

          <p className="login-card__footer">
            Guest accounts are temporary demo sessions.
            <br />
            Sign in with Google to save your progress.
          </p>
        </div>
      </div>
    </div>
  );
}
