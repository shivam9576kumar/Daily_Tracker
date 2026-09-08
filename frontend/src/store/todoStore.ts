import { create } from 'zustand';
import { todoApi } from '../services/todoApi';
import { getErrorMessage } from '../services/api';
import type { TodoResponse } from '../types';

interface TodoState {
  data: TodoResponse | null;
  loading: boolean;
  error: string | null;
  fetch: (silent?: boolean) => Promise<void>;
}

export const useTodoStore = create<TodoState>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetch: async (silent = false) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const data = await todoApi.get();
      set({ data, loading: false, error: null });
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false });
    }
  },
}));
