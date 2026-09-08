import api from './api';
import type { ApiResponse, Recurrence, Task, TodoResponse } from '../types';

export type UpcomingRange = 14 | 30;

export const todoApi = {
  async get(upcomingDays: UpcomingRange = 14): Promise<TodoResponse> {
    const res = await api.get<ApiResponse<TodoResponse>>('/todo', {
      params: { upcomingDays },
    });
    return res.data.data;
  },

  async createPersonal(payload: {
    title: string;
    scheduledDateKey?: string | null;
    recurrence?: Recurrence | null;
    dueTime?: string | null;
  }): Promise<Task> {
    const res = await api.post<ApiResponse<Task>>('/todo/tasks', payload);
    return res.data.data;
  },

  async updatePersonal(
    id: string,
    payload: {
      title?: string;
      scheduledDateKey?: string | null;
      recurrence?: Recurrence | null;
      dueTime?: string | null;
    },
  ): Promise<Task> {
    const res = await api.patch<ApiResponse<Task>>(`/todo/tasks/${id}`, payload);
    return res.data.data;
  },
};
