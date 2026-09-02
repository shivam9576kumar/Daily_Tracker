import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

/**
 * Auth callback page — receives the JWT token from Google OAuth redirect
 * and stores it, then navigates to dashboard.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { setToken, fetchUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setToken(token);
      fetchUser().then(() => navigate('/', { replace: true }));
    } else {
      navigate('/login', { replace: true });
    }
  }, [searchParams, setToken, fetchUser, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-primary)',
      color: 'var(--color-text-secondary)',
    }}>
      Signing you in...
    </div>
  );
}
