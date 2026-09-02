import api from './api';
import type { ApiResponse, ActivePlanResponse, PlanPreviewData, ParsedPlanSettings, GeneratePlanPayload } from '../types';

export const planApi = {
  async getActive(): Promise<ActivePlanResponse> {
    const res = await api.get<ApiResponse<ActivePlanResponse>>('/plans/active');
    return res.data.data;
  },

  async aiParse(prompt: string): Promise<ParsedPlanSettings> {
    const res = await api.post<ApiResponse<ParsedPlanSettings>>('/plans/ai-parse', { prompt });
    return res.data.data;
  },

  async preview(payload: GeneratePlanPayload): Promise<PlanPreviewData> {
    const res = await api.post<ApiResponse<PlanPreviewData>>('/plans/preview', payload);
    return res.data.data;
  },

  async commit(payload: GeneratePlanPayload): Promise<{ plan: any; tasksCreated: number }> {
    const res = await api.post<ApiResponse<{ plan: any; tasksCreated: number }>>('/plans/commit', payload);
    return res.data.data;
  },

  async archive(planId: string): Promise<{ message: string }> {
    const res = await api.patch<ApiResponse<{ message: string }>>(`/plans/${planId}/archive`);
    return res.data.data;
  },
};
