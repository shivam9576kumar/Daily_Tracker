import api from './api';

export const taskApi = {
  /** GET /api/dashboard/today */
  async getDashboard() {
    const res = await api.get('/dashboard/today');
    return res.data.data;
  },

  /** GET /api/tasks */
  async getAll(filters?: Record<string, string>) {
    const res = await api.get('/tasks', { params: filters });
    return res.data.data;
  },

  /** GET /api/tasks/:id */
  async getById(id: string) {
    const res = await api.get(`/tasks/${id}`);
    return res.data.data;
  },

  /** POST /api/tasks */
  async create(data: {
    title: string;
    topic: string;
    difficulty: string;
    platform: string;
    problemUrl?: string;
    scheduledDate: string;
  }) {
    const res = await api.post('/tasks', data);
    return res.data.data;
  },

  /** PATCH /api/tasks/:id */
  async update(id: string, data: Record<string, unknown>) {
    const res = await api.patch(`/tasks/${id}`, data);
    return res.data.data;
  },

  /** DELETE /api/tasks/:id */
  async remove(id: string) {
    await api.delete(`/tasks/${id}`);
  },

  /** POST /api/tasks/:id/complete */
  async complete(id: string, rating?: string) {
    const res = await api.post(`/tasks/${id}/complete`, { rating });
    return res.data.data;
  },

  /** POST /api/tasks/:id/rate (re-rate) */
  async rate(id: string, rating: string) {
    const res = await api.post(`/tasks/${id}/rate`, { rating });
    return res.data.data;
  },

  /** POST /api/tasks/:id/undo */
  async undo(id: string) {
    const res = await api.post(`/tasks/${id}/undo`);
    return res.data.data;
  },

  /** GET /api/tasks/:id/notes */
  async getNotes(id: string) {
    const res = await api.get(`/tasks/${id}/notes`);
    return res.data.data;
  },

  /** PUT /api/tasks/:id/notes */
  async saveNotes(id: string, content: string) {
    const res = await api.put(`/tasks/${id}/notes`, { content });
    return res.data.data;
  },
};

export const assignmentApi = {
  /** GET /api/assignments */
  async getAll() {
    const res = await api.get('/assignments');
    return res.data.data;
  },

  /** POST /api/assignments */
  async create(data: { title: string; description?: string; deadline: string }) {
    const res = await api.post('/assignments', data);
    return res.data.data;
  },

  /** PATCH /api/assignments/:id */
  async update(id: string, data: Record<string, unknown>) {
    const res = await api.patch(`/assignments/${id}`, data);
    return res.data.data;
  },

  /** DELETE /api/assignments/:id */
  async remove(id: string) {
    await api.delete(`/assignments/${id}`);
  },

  /** Mark as done (optimistic) */
  async markDone(id: string) {
    const res = await api.patch(`/assignments/${id}`, { status: 'completed' });
    return res.data.data;
  },
};
