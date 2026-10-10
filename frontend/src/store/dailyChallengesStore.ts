import { create } from 'zustand';
import { dailyChallengesApi } from '../services/dailyChallengesApi';
import { getErrorMessage } from '../services/api';
import { useTodoStore } from './todoStore';
import { useDashboardStore } from './dashboardStore';
import { useUIStore } from './uiStore';
import { createLatestGate } from '../utils/latestGate';
import { createSerialQueue } from '../utils/serialQueue';
import type { DailyChallengeSettings } from '../types';

interface DailyChallengesState {
  settings: DailyChallengeSettings | null;
  loading: boolean;
  /** True while at least one mutation is running or queued. Use for a spinner only, never to disable controls. */
  saving: boolean;
  error: string | null;
  fetch: (silent?: boolean) => Promise<void>;
  setPotdEnabled: (enabled: boolean) => Promise<void>;
  enableCp31: (band: number) => Promise<void>;
  disableCp31: () => Promise<void>;
  setCp31Band: (band: number) => Promise<void>;
  setCp31DailyCount: (count: number) => Promise<void>;
  cp31OneMore: () => Promise<void>;
  cp31Skip: (taskId: string) => Promise<void>;
  cp31Retry: (taskId: string) => Promise<void>;
  cp31AdvanceBand: () => Promise<void>;
}

type Setter = (partial: Partial<DailyChallengesState>) => void;

const queue = createSerialQueue();
const settingsGate = createLatestGate();

function refreshTodoAndDashboard(): void {
  void useTodoStore.getState().fetch(true);
  void useDashboardStore.getState().fetch(true);
}

async function afterLadderChange(): Promise<void> {
  refreshTodoAndDashboard();
  await useDailyChallengesStore.getState().fetch(true);
}

function reportError(set: Setter, err: unknown): void {
  const message = getErrorMessage(err);
  set({ error: message });
  useUIStore.getState().toast(message, 'error');
}

/**
 * Every mutation goes through one serial queue (D3).
 * `queue.depth` still counts the current task while it runs, so `<= 1` means nothing is queued behind it.
 */
function enqueue(set: Setter, work: () => Promise<void>): Promise<void> {
  set({ saving: true, error: null });
  return queue.run(async () => {
    try {
      await work();
    } finally {
      if (queue.depth <= 1) set({ saving: false });
    }
  });
}

export const useDailyChallengesStore = create<DailyChallengesState>((set) => ({
  settings: null,
  loading: false,
  saving: false,
  error: null,

  fetch: async (silent = false) => {
    const token = settingsGate.begin();
    if (!silent) set({ loading: true, error: null });
    try {
      const settings = await dailyChallengesApi.getSettings();
      if (!settingsGate.isLatest(token)) return;
      set({ settings, loading: false });
    } catch (err) {
      if (!settingsGate.isLatest(token)) return;
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  setPotdEnabled: (enabled) =>
    enqueue(set, async () => {
      try {
        const res = await dailyChallengesApi.updateSettings({ potdEnabled: enabled });
        set({ settings: res.settings });
        useUIStore.getState().toast(
          enabled
            ? 'LeetCode POTD turned on'
            : `LeetCode POTD turned off${res.changes.potdUnsolvedRemoved ? ' · today’s pending challenge removed' : ''}`,
          'info',
        );
        refreshTodoAndDashboard();
      } catch (err) {
        reportError(set, err);
      }
    }),

  enableCp31: (band) =>
    enqueue(set, async () => {
      try {
        const res = await dailyChallengesApi.updateSettings({ cp31Enabled: true, cp31Band: band });
        set({ settings: res.settings });
        useUIStore.getState().toast(`CP31 enabled — Band ${band}`, 'success');
        refreshTodoAndDashboard();
      } catch (err) {
        reportError(set, err);
      }
    }),

  disableCp31: () =>
    enqueue(set, async () => {
      try {
        const res = await dailyChallengesApi.updateSettings({ cp31Enabled: false });
        set({ settings: res.settings });
        useUIStore.getState().toast('CP31 paused — progress saved', 'info');
        refreshTodoAndDashboard();
      } catch (err) {
        reportError(set, err);
      }
    }),

  setCp31Band: (band) =>
    enqueue(set, async () => {
      try {
        const res = await dailyChallengesApi.updateSettings({ cp31Band: band });
        set({ settings: res.settings });
        useUIStore.getState().toast(`Switched to Band ${band}`, 'success');
        refreshTodoAndDashboard();
      } catch (err) {
        reportError(set, err);
      }
    }),

  setCp31DailyCount: (count) =>
    enqueue(set, async () => {
      try {
        const res = await dailyChallengesApi.updateSettings({ cp31DailyCount: count });
        set({ settings: res.settings });
        useUIStore.getState().toast(`Daily quota set to ${count}`, 'info');
        refreshTodoAndDashboard();
      } catch (err) {
        reportError(set, err);
      }
    }),

  // ── CP31 ladder (moved from todoStore, D4). Each refreshes settings too (band can change). ──

  cp31OneMore: () =>
    enqueue(set, async () => {
      try {
        await dailyChallengesApi.oneMore();
        await afterLadderChange();
      } catch (err) {
        reportError(set, err);
      }
    }),

  cp31Skip: (taskId) =>
    enqueue(set, async () => {
      try {
        await dailyChallengesApi.skip(taskId);
        useUIStore.getState().toast('Skipped — no coins for this one', 'info');
        await afterLadderChange();
      } catch (err) {
        reportError(set, err);
      }
    }),

  cp31Retry: (taskId) =>
    enqueue(set, async () => {
      try {
        await dailyChallengesApi.retry(taskId);
        useUIStore.getState().toast('Problem is back in today’s list', 'success');
        await afterLadderChange();
      } catch (err) {
        reportError(set, err);
      }
    }),

  cp31AdvanceBand: () =>
    enqueue(set, async () => {
      try {
        const res = await dailyChallengesApi.advanceBand();
        useUIStore.getState().toast(`Moved to Band ${res.band}`, 'success');
        await afterLadderChange();
      } catch (err) {
        reportError(set, err);
      }
    }),
}));
