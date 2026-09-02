import api from './api';
import type { ApiResponse, DashboardData } from '../types';

export const dashboardApi = {
  async getToday(): Promise<DashboardData> {
    const res = await api.get<ApiResponse<DashboardData>>('/dashboard/today');
    return res.data.data;
  },
};
