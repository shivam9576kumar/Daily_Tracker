import axios from 'axios';
import { tokenStorage } from './tokenStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const BROWSER_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
})();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000, // was 20s; rate can legitimately take several seconds on cold DB
});

// Attach JWT and X-Timezone to every request
api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Timezone'] = BROWSER_TZ;
  return config;
});

// Auto-logout on 401 & surface server error messages
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      tokenStorage.clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    const message =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      (err.code === 'ECONNABORTED' ? 'Server is taking too long — please try again' : err.message) ||
      'Something went wrong';
    err.friendlyMessage = message;
    return Promise.reject(err);
  }
);

/** Extract a human-readable message from an Axios error. */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (err as any).friendlyMessage || err.response?.data?.error || err.response?.data?.message || err.message || 'Something went wrong';
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

export default api;
