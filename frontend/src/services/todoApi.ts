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
    durationMin?: number | null;
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
      durationMin?: number | null;
    },
  ): Promise<Task> {
    const res = await api.patch<ApiResponse<Task>>(`/todo/tasks/${id}`, payload);
    return res.data.data;
  },

  async cp31OneMore(): Promise<Task> {
    const res = await api.post<ApiResponse<Task>>('/daily-challenges/cp31/one-more');
    return res.data.data;
  },

  async cp31Skip(taskId: string): Promise<Task> {
    const res = await api.post<ApiResponse<Task>>(`/daily-challenges/cp31/skip/${taskId}`);
    return res.data.data;
  },

  async cp31AdvanceBand(): Promise<{ cp31Band: number }> {
    const res = await api.post<ApiResponse<{ cp31Band: number }>>('/daily-challenges/cp31/advance-band');
    return res.data.data;
  },
};
