import { create } from 'zustand';
import { progressApi } from '../services/progressApi';
import { getErrorMessage } from '../services/api';
import type { ProgressOverview } from '../types';

type Scope = 'plan' | 'all' | undefined;

interface ProgressState {
  data: ProgressOverview | null;
  loading: boolean;
  error: string | null;
  scope: Scope;
  fetch: (opts?: { scope?: 'plan' | 'all'; silent?: boolean }) => Promise<void>;
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  scope: undefined,

  fetch: async (opts) => {
    const scope = opts?.scope ?? get().scope;
    if (!opts?.silent) set({ loading: true, error: null });
    try {
      const data = await progressApi.getOverview(scope ? { scope } : undefined);
      set({ data, scope, loading: false, error: null });
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },
}));
