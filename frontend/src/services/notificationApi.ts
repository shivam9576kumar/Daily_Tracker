import api from './api';
import type { ApiResponse, AppNotification } from '../types';

export const notificationApi = {
  async getUnread(): Promise<AppNotification[]> {
    const res = await api.get<ApiResponse<AppNotification[]>>(
      '/notifications/unread'
    );
    return res.data.data;
  },

  async markAllRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },
};
