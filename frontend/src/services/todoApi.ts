import api from './api';
import type { ApiResponse, TodoResponse } from '../types';

export const todoApi = {
  async get(): Promise<TodoResponse> {
    const res = await api.get<ApiResponse<TodoResponse>>('/todo');
    return res.data.data;
  },
};
