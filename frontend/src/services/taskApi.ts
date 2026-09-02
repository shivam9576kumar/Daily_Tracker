import api from './api';
import type { ApiResponse, CreateTaskPayload, Rating, Task } from '../types';

export const taskApi = {
  async getAll(params?: Record<string, string>): Promise<Task[]> {
    const res = await api.get<ApiResponse<Task[]>>('/tasks', { params });
    return res.data.data;
  },

  async getById(id: string): Promise<Task> {
    const res = await api.get<ApiResponse<Task>>(`/tasks/${id}`);
    return res.data.data;
  },

  async create(payload: CreateTaskPayload): Promise<Task> {
    const res = await api.post<ApiResponse<Task>>('/tasks', payload);
    return res.data.data;
  },

  async update(id: string, payload: Partial<CreateTaskPayload>): Promise<Task> {
    const res = await api.patch<ApiResponse<Task>>(`/tasks/${id}`, payload);
    return res.data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },

  async complete(id: string, rating?: Rating): Promise<Task> {
    const res = await api.post<ApiResponse<Task>>(`/tasks/${id}/complete`, {
      rating,
    });
    return res.data.data;
  },

  async rerate(id: string, rating: Rating): Promise<Task> {
    const res = await api.post<ApiResponse<Task>>(`/tasks/${id}/rate`, {
      rating,
    });
    return res.data.data;
  },

  async undo(id: string): Promise<Task> {
    const res = await api.post<ApiResponse<Task>>(`/tasks/${id}/undo`);
    return res.data.data;
  },
};

export { assignmentApi } from './assignmentApi';

