import api from './api';
import type { ApiResponse, ClassRow } from '../types';

export interface ClassInput {
  dayOfWeek: number;
  subject: string;
  startTime: string;
  endTime: string;
  location?: string | null;
}

export const classesApi = {
  list: () =>
    api.get<ApiResponse<ClassRow[]>>('/classes').then((r) => r.data.data),
  replaceAll: (classes: ClassInput[]) =>
    api
      .put<ApiResponse<ClassRow[]>>('/classes', { classes })
      .then((r) => r.data.data),
  clear: () => api.delete('/classes'),
};
