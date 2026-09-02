import api from './api';
import type { ApiResponse, ProgressOverview } from '../types';

export const progressApi = {
  async getOverview(params?: { scope?: 'plan' | 'all'; months?: number }): Promise<ProgressOverview> {
    const res = await api.get<ApiResponse<ProgressOverview>>('/progress/overview', { params });
    return res.data.data;
  },
};
