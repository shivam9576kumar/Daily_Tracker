import api from './api';
import type { ApiResponse, ActivePlanResponse, ArchivedPlan } from '../types';

export const planApi = {
  async getActive(): Promise<ActivePlanResponse> {
    const res = await api.get<ApiResponse<ActivePlanResponse>>('/plans/active');
    return res.data.data;
  },
  async getArchived(): Promise<ArchivedPlan[]> {
    const res = await api.get<ApiResponse<ArchivedPlan[]>>('/plans/archived');
    return res.data.data;
  },
  async restore(id: string) {
    const res = await api.post<ApiResponse<any>>(`/plans/${id}/restore`);
    return res.data.data;
  },
  async remove(id: string) {
    const res = await api.delete<ApiResponse<any>>(`/plans/${id}`);
    return res.data.data;
  },
  async aiParse(prompt: string) {
    const res = await api.post('/plans/ai-parse', { prompt });
    return res.data.data;
  },
  async preview(payload: any) {
    const res = await api.post('/plans/preview', payload);
    return res.data.data;
  },
  async commit(payload: any) {
    const res = await api.post('/plans/commit', payload);
    return res.data.data;
  },
};
