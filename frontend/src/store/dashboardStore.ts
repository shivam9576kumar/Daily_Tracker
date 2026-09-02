import { create } from 'zustand';
import { dashboardApi } from '../services/dashboardApi';
import { getErrorMessage } from '../services/api';
import type { DashboardData } from '../types';

interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  fetch: (silent?: boolean) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetch: async (silent = false) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const data = await dashboardApi.getToday();
      set({ data, loading: false, error: null });
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },
}));
