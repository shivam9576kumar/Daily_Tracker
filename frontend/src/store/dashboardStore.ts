import { create } from 'zustand';
import { dashboardApi } from '../services/dashboardApi';
import { getErrorMessage } from '../services/api';
import { createLatestGate } from '../utils/latestGate';
import type { DashboardData } from '../types';

interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  fetch: (silent?: boolean) => Promise<void>;
}

const gate = createLatestGate();

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  loading: false,
  error: null,

  fetch: async (silent = false) => {
    const token = gate.begin();
    if (!silent) set({ loading: true, error: null });
    try {
      const data = await dashboardApi.getToday({ silent });
      if (!gate.isLatest(token)) return;
      set({ data, loading: false, error: null });
    } catch (err) {
      if (!gate.isLatest(token)) return;
      set({ error: getErrorMessage(err), loading: false });
    }
  },
}));
