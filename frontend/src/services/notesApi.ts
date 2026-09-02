import api from './api';
import type { ApiResponse, Note } from '../types';

export const notesApi = {
  async get(taskId: string): Promise<Note[]> {
    const res = await api.get<ApiResponse<Note[]>>(`/tasks/${taskId}/notes`);
    return res.data.data;
  },

  async upsert(taskId: string, content: string): Promise<Note> {
    const res = await api.put<ApiResponse<Note>>(`/tasks/${taskId}/notes`, { content });
    return res.data.data;
  },
};
