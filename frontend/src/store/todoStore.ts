import { create } from 'zustand';
import { todoApi, type UpcomingRange } from '../services/todoApi';
import { getErrorMessage } from '../services/api';
import type { TodoResponse } from '../types';

interface TodoState {
  data: TodoResponse | null;
  loading: boolean;
  error: string | null;
  upcomingDays: UpcomingRange;
  fetch: (silent?: boolean) => Promise<void>;
  setUpcomingDays: (days: UpcomingRange) => Promise<void>;
  cp31OneMore: () => Promise<void>;
  cp31Skip: (taskId: string) => Promise<void>;
  cp31AdvanceBand: () => Promise<void>;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  upcomingDays: 14,

  fetch: async (silent = false) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const data = await todoApi.get(get().upcomingDays);
      set({ data, loading: false, error: null });
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },

  setUpcomingDays: async (days) => {
    if (get().upcomingDays === days) return;
    set({ upcomingDays: days });
    await get().fetch(true); // silent refetch — no full-page spinner
  },

  cp31OneMore: async () => {
    try {
      await todoApi.cp31OneMore();
      await get().fetch(true);
    } catch (err) {
      throw err;
    }
  },

  cp31Skip: async (taskId: string) => {
    try {
      await todoApi.cp31Skip(taskId);
      await get().fetch(true);
    } catch (err) {
      throw err;
    }
  },

  cp31AdvanceBand: async () => {
    try {
      await todoApi.cp31AdvanceBand();
      await get().fetch(true);
    } catch (err) {
      throw err;
    }
  },
}));
