import api from './api';
import type { ApiResponse, DashboardData } from '../types';

export const dashboardApi = {
  async getToday(options?: { silent?: boolean }): Promise<DashboardData> {
    const res = await api.get<ApiResponse<DashboardData>>('/dashboard/today', { silent: options?.silent });
    return res.data.data;
  },
};
