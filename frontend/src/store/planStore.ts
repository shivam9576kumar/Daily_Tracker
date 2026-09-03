import { create } from 'zustand';
import { planApi } from '../services/planApi';
import { getErrorMessage } from '../services/api';
import type { ActivePlanResponse, ArchivedPlan } from '../types';

interface PlanState {
  data: ActivePlanResponse | null;
  archived: ArchivedPlan[];
  loading: boolean;
  error: string | null;
  fetchActive: () => Promise<void>;
  fetchArchived: () => Promise<void>;
}

export const usePlanStore = create<PlanState>((set) => ({
  data: null,
  archived: [],
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
  fetchArchived: async () => {
    try {
      const archived = await planApi.getArchived();
      set({ archived });
    } catch { /* silent */ }
  },
}));
