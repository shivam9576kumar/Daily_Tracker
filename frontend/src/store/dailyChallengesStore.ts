import { create } from 'zustand';
import { dailyChallengesApi } from '../services/dailyChallengesApi';
import { getErrorMessage } from '../services/api';
import { useTodoStore } from './todoStore';
import { useDashboardStore } from './dashboardStore';
import { useUIStore } from './uiStore';
import type { DailyChallengeSettings } from '../types';

interface DailyChallengesState {
  settings: DailyChallengeSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  setPotdEnabled: (enabled: boolean) => Promise<void>;
}

export const useDailyChallengesStore = create<DailyChallengesState>((set, get) => ({
  settings: null,
  loading: false,
  saving: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      set({ settings: await dailyChallengesApi.getSettings(), loading: false });
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  setPotdEnabled: async (enabled) => {
    if (get().saving) return;
    set({ saving: true, error: null });
    try {
      const res = await dailyChallengesApi.updateSettings({ potdEnabled: enabled });
      set({ settings: res.settings, saving: false });
      useUIStore.getState().toast(
        enabled
          ? 'LeetCode POTD turned on'
          : `LeetCode POTD turned off${res.changes.potdUnsolvedRemoved ? ' · today’s pending challenge removed' : ''}`,
        'info',
      );
      // Counts on Todo + Dashboard reflect the change immediately (silent refetch).
      await Promise.all([
        useTodoStore.getState().fetch(true),
        useDashboardStore.getState().fetch(true),
      ]);
    } catch (err) {
      set({ error: getErrorMessage(err), saving: false });
    }
  },
}));
