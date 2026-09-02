import api from './api';
import type { ApiResponse, Assignment, CreateAssignmentPayload } from '../types';

export const assignmentApi = {
  async getAll(): Promise<Assignment[]> {
    const res = await api.get<ApiResponse<Assignment[]>>('/assignments');
    return res.data.data;
  },

  async create(payload: CreateAssignmentPayload): Promise<Assignment> {
    const res = await api.post<ApiResponse<Assignment>>('/assignments', payload);
    return res.data.data;
  },

  async update(
    id: string,
    payload: Partial<CreateAssignmentPayload> & { status?: 'pending' | 'completed' }
  ): Promise<Assignment> {
    const res = await api.patch<ApiResponse<Assignment>>(`/assignments/${id}`, payload);
    return res.data.data;
  },

  async complete(id: string): Promise<Assignment> {
    return this.update(id, { status: 'completed' });
  },

  async reopen(id: string): Promise<Assignment> {
    return this.update(id, { status: 'pending' });
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/assignments/${id}`);
  },
};
