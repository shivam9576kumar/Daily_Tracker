import api from './api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const authApi = {
  /** Get Google OAuth login URL */
  getGoogleLoginUrl() {
    return `${API_BASE}/auth/google`;
  },

  /** Get current user profile */
  async getMe() {
    const res = await api.get('/auth/me');
    return res.data.data;
  },

  /** Logout */
  async logout() {
    await api.post('/auth/logout');
  },
};
