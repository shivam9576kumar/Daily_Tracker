import { useEffect } from 'react';
import './index.css';
import AppRoutes from './routes/AppRoutes';
import { useAuthStore } from './store/authStore';

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <AppRoutes />;
}
