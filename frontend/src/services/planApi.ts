import api from './api';
import type { ApiResponse, ActivePlanResponse, ArchivedPlan, AIConversationRequest, AIConversationResponse } from '../types';

const AI_TIMEOUT_MS = 60_000;
const COMMIT_TIMEOUT_MS = 30_000;

export const planApi = {
  async getAiStatus(): Promise<{ enabled: boolean; model: string | null }> {
    const res = await api.get<ApiResponse<{ enabled: boolean; model: string | null }>>('/plans/ai-status');
    return res.data.data;
  },
  async aiConversation(payload: AIConversationRequest): Promise<AIConversationResponse> {
    const res = await api.post('/plans/ai-conversation', payload, { timeout: AI_TIMEOUT_MS });
    return res.data.data;
  },
  async getActive(options?: { silent?: boolean }): Promise<ActivePlanResponse> {
    const res = await api.get<ApiResponse<ActivePlanResponse>>('/plans/active', { silent: options?.silent });
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
    const res = await api.post('/plans/ai-parse', { prompt }, { timeout: AI_TIMEOUT_MS });
    return res.data.data;
  },
  async preview(payload: any) {
    const res = await api.post('/plans/preview', payload);
    return res.data.data;
  },
  async commit(payload: any) {
    const res = await api.post('/plans/commit', payload, { timeout: COMMIT_TIMEOUT_MS });
    return res.data.data;
  },
  async getTopics(source: string): Promise<{ source: string; topics: { name: string; count: number }[] }> {
    const res = await api.get('/plans/topics', { params: { source } });
    return res.data.data;
  },
};

