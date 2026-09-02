import { useEffect } from 'react';
import './index.css';
import AppRoutes from './routes/AppRoutes';
import { useAuthStore } from './store/authStore';
import ToastContainer from './components/common/ToastContainer';
import NotificationListener from './components/common/NotificationListener';

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <>
      <AppRoutes />
      <NotificationListener />
      <ToastContainer />
    </>
  );
}
