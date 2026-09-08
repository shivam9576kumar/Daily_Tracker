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
  enableCp31: (band: number) => Promise<void>;
  disableCp31: () => Promise<void>;
  setCp31Band: (band: number) => Promise<void>;
  setCp31DailyCount: (count: number) => Promise<void>;
}

/** Silently refresh both Todo and Dashboard data after a settings change. */
function silentRefresh(): void {
  void useTodoStore.getState().fetch(true);
  void useDashboardStore.getState().fetch(true);
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
          : `LeetCode POTD turned off${res.changes.potdUnsolvedRemoved ? ' · today\u2019s pending challenge removed' : ''}`,
        'info',
      );
      silentRefresh();
    } catch (err) {
      set({ error: getErrorMessage(err), saving: false });
    }
  },

  enableCp31: async (band) => {
    if (get().saving) return;
    set({ saving: true, error: null });
    try {
      const res = await dailyChallengesApi.updateSettings({
        cp31Enabled: true,
        cp31Band: band,
      });
      set({ settings: res.settings, saving: false });
      useUIStore.getState().toast(`CP31 enabled — Band ${band}`, 'success');
      silentRefresh();
    } catch (err) {
      set({ error: getErrorMessage(err), saving: false });
    }
  },

  disableCp31: async () => {
    if (get().saving) return;
    set({ saving: true, error: null });
    try {
      const res = await dailyChallengesApi.updateSettings({ cp31Enabled: false });
      set({ settings: res.settings, saving: false });
      useUIStore.getState().toast('CP31 paused — progress saved', 'info');
      silentRefresh();
    } catch (err) {
      set({ error: getErrorMessage(err), saving: false });
    }
  },

  setCp31Band: async (band) => {
    if (get().saving) return;
    set({ saving: true, error: null });
    try {
      const res = await dailyChallengesApi.updateSettings({ cp31Band: band });
      set({ settings: res.settings, saving: false });
      useUIStore.getState().toast(`Switched to Band ${band}`, 'success');
      silentRefresh();
    } catch (err) {
      set({ error: getErrorMessage(err), saving: false });
    }
  },

  setCp31DailyCount: async (count) => {
    if (get().saving) return;
    set({ saving: true, error: null });
    try {
      const res = await dailyChallengesApi.updateSettings({ cp31DailyCount: count });
      set({ settings: res.settings, saving: false });
      useUIStore.getState().toast(`Daily quota set to ${count}`, 'info');
      silentRefresh();
    } catch (err) {
      set({ error: getErrorMessage(err), saving: false });
    }
  },
}));
