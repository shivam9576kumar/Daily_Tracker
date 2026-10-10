import { create } from 'zustand';
import { todoApi, type UpcomingRange } from '../services/todoApi';
import { getErrorMessage } from '../services/api';
import { createLatestGate } from '../utils/latestGate';
import type { TodoResponse } from '../types';

interface TodoState {
  data: TodoResponse | null;
  loading: boolean;
  error: string | null;
  upcomingDays: UpcomingRange;
  fetch: (silent?: boolean) => Promise<void>;
  setUpcomingDays: (days: UpcomingRange) => Promise<void>;
}

const gate = createLatestGate();

export const useTodoStore = create<TodoState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  upcomingDays: 14,

  fetch: async (silent = false) => {
    const token = gate.begin();
    if (!silent) set({ loading: true, error: null });
    try {
      const data = await todoApi.get(get().upcomingDays, { silent });
      if (!gate.isLatest(token)) return;
      set({ data, loading: false, error: null });
    } catch (err) {
      if (!gate.isLatest(token)) return;
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  setUpcomingDays: async (days) => {
    if (get().upcomingDays === days) return;
    set({ upcomingDays: days });
    await get().fetch(true);
  },
}));
