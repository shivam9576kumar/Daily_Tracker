import { create } from 'zustand';
import { planApi } from '../services/planApi';
import { getErrorMessage } from '../services/api';
import { createLatestGate } from '../utils/latestGate';
import type { ActivePlanResponse, ArchivedPlan } from '../types';

interface PlanState {
  data: ActivePlanResponse | null;
  archived: ArchivedPlan[];
  loading: boolean;
  error: string | null;
  fetchActive: (options?: { silent?: boolean }) => Promise<void>;
  fetchArchived: () => Promise<void>;
}

const activeGate = createLatestGate();

export const usePlanStore = create<PlanState>((set, get) => ({
  data: null,
  archived: [],
  loading: false,
  error: null,

  fetchActive: async (options) => {
    const silent = options?.silent === true;
    const token = activeGate.begin();
    // Spinner only for the very first load. Background refreshes never flip loading.
    const showSpinner = !silent && get().data === null;
    if (showSpinner) set({ loading: true, error: null });
    try {
      const data = await planApi.getActive({ silent });
      if (!activeGate.isLatest(token)) return;
      set({ data, loading: false, error: null });
    } catch (err) {
      if (!activeGate.isLatest(token)) return;
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  fetchArchived: async () => {
    try {
      const archived = await planApi.getArchived();
      set({ archived });
    } catch {
      /* silent */
    }
  },
}));
