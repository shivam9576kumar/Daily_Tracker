import api from './api';
import type { ApiResponse, TodoResponse } from '../types';

export type UpcomingRange = 14 | 30;

export const todoApi = {
  async get(upcomingDays: UpcomingRange = 14): Promise<TodoResponse> {
    const res = await api.get<ApiResponse<TodoResponse>>('/todo', {
      params: { upcomingDays },
    });
    return res.data.data;
  },
};
