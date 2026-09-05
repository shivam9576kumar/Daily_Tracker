import api from './api';
import type { PotdStreak } from '../types';

export const potdApi = {
  async dismiss(dateKey: string): Promise<void> {
    await api.post('/potd/dismiss', { dateKey });
  },

  async streak(): Promise<PotdStreak> {
    const res = await api.get('/potd/streak');
    return res.data.data;
  },
};
