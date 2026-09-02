import { useEffect } from 'react';
import { notificationApi } from '../../services/notificationApi';
import { tokenStorage } from '../../services/tokenStorage';
import { useUIStore } from '../../store/uiStore';

export default function NotificationListener() {
  const toast = useUIStore((s) => s.toast);

  useEffect(() => {
    let cancelled = false;

    const checkNotifications = async () => {
      const token = tokenStorage.get();
      if (!token) return;

      try {
        const notifications = await notificationApi.getUnread();

        if (cancelled || notifications.length === 0) return;

        for (const n of notifications.reverse()) {
          toast(
            `${n.title}: ${n.message}`,
            n.type === 'expired' ? 'error' : 'info'
          );
        }

        await notificationApi.markAllRead();
      } catch {
        // Do not disturb the user if notification polling fails.
      }
    };

    checkNotifications();

    const interval = window.setInterval(checkNotifications, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [toast]);

  return null;
}
