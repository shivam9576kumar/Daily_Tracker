import { create } from 'zustand';
import { planApi } from '../services/planApi';
import { getErrorMessage } from '../services/api';
import type { ActivePlanResponse } from '../types';

interface PlanState {
  data: ActivePlanResponse | null;
  loading: boolean;
  error: string | null;
  fetchActive: () => Promise<void>;
}

export const usePlanStore = create<PlanState>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetchActive: async () => {
    set({ loading: true, error: null });
    try {
      const data = await planApi.getActive();
      set({ data, loading: false });
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },
}));
