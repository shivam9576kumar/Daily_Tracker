import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../services/authApi';
import { useUIStore } from '../../store/uiStore';
import { getErrorMessage } from '../../services/api';

/**
 * Auth callback page — receives the short-lived exchange code from Google OAuth redirect,
 * trades it for the JWT token over POST /api/auth/exchange, then navigates to dashboard.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const setToken = useAuthStore((s) => s.setToken);
  const toast = useUIStore((s) => s.toast);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      toast('Missing authorization code', 'error');
      navigate('/login', { replace: true });
      return;
    }

    let mounted = true;
    authApi.exchangeCode(code)
      .then(async ({ token }) => {
        if (!mounted) return;
        await setToken(token);
        navigate('/', { replace: true });
      })
      .catch((err) => {
        if (!mounted) return;
        const msg = getErrorMessage(err);
        setError(msg);
        toast(msg, 'error');
        navigate('/login', { replace: true });
      });

    return () => {
      mounted = false;
    };
  }, [searchParams, setToken, toast, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-page)',
      color: 'var(--text-secondary)',
    }}>
      {error ? `Sign-in failed: ${error}` : 'Signing you in...'}
    </div>
  );
}
