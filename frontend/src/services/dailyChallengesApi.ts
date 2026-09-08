import api from './api';
import type {
  ApiResponse,
  DailyChallengeSettings,
  DailyChallengeSettingsPatch,
  DailyChallengeSettingsResponse,
  Task,
  Cp31StreakResult,
} from '../types';

export const dailyChallengesApi = {
  async getSettings(): Promise<DailyChallengeSettings> {
    const res = await api.get<ApiResponse<DailyChallengeSettings>>('/daily-challenges/settings');
    return res.data.data;
  },

  async updateSettings(patch: DailyChallengeSettingsPatch): Promise<DailyChallengeSettingsResponse> {
    const res = await api.patch<ApiResponse<DailyChallengeSettingsResponse>>('/daily-challenges/settings', patch);
    return res.data.data;
  },

  async oneMore(): Promise<{ task: Task; state: any }> {
    const res = await api.post<ApiResponse<{ task: Task; state: any }>>('/daily-challenges/cp31/one-more');
    return res.data.data;
  },

  async skip(taskId: string): Promise<{ skipped: Task; served: Task[]; state: any }> {
    const res = await api.post<ApiResponse<{ skipped: Task; served: Task[]; state: any }>>(`/daily-challenges/cp31/skip/${taskId}`);
    return res.data.data;
  },

  async retry(taskId: string): Promise<{ task: Task; state: any }> {
    const res = await api.post<ApiResponse<{ task: Task; state: any }>>(`/daily-challenges/cp31/retry/${taskId}`);
    return res.data.data;
  },

  async getSkipped(): Promise<Task[]> {
    const res = await api.get<ApiResponse<Task[]>>('/daily-challenges/cp31/skipped');
    return res.data.data;
  },

  async advanceBand(): Promise<{ band: number; served: Task[]; state: any }> {
    const res = await api.post<ApiResponse<{ band: number; served: Task[]; state: any }>>('/daily-challenges/cp31/advance-band');
    return res.data.data;
  },

  async getStreak(): Promise<Cp31StreakResult> {
    const res = await api.get<ApiResponse<Cp31StreakResult>>('/daily-challenges/cp31/streak');
    return res.data.data;
  },
};
