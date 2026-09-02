import { create } from 'zustand';
import api from '../services/api';
import { tokenStorage } from '../services/tokenStorage';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  coins: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setToken: (token: string) => void;
  fetchUser: () => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: tokenStorage.get(),
  isLoading: true,
  isAuthenticated: false,

  setToken: (token: string) => {
    tokenStorage.set(token);
    set({ token, isAuthenticated: true });
  },

  fetchUser: async () => {
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data.data, isAuthenticated: true, isLoading: false });
    } catch {
      tokenStorage.clear();
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: () => {
    tokenStorage.clear();
    set({ user: null, token: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  initialize: async () => {
    const token = tokenStorage.get();
    if (token) {
      set({ token });
      await get().fetchUser();
    } else {
      set({ isLoading: false });
    }
  },
}));
