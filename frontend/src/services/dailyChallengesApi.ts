import api from './api';
import type {
  ApiResponse,
  DailyChallengeSettings,
  DailyChallengeSettingsPatch,
  DailyChallengeSettingsResponse,
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
};
