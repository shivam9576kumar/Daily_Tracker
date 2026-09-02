import prisma from '../../config/database';
import { taskRepository } from '../../repositories/taskRepository';
import { NotFoundError, ValidationError } from '../../utils/error';
import logger from '../../utils/logger';

/**
 * Core task service — CRUD operations and business logic.
 */
export const taskService = {
  async getTodaysTasks(userId: string) {
    return taskRepository.getTodaysTasks(userId);
  },

  async getTaskById(taskId: string, userId: string) {
    const task = await taskRepository.getTaskById(taskId, userId);
    if (!task) throw new NotFoundError('Task');
    return task;
  },

  async getAllTasks(userId: string, filters?: {
    status?: string;
    topic?: string;
    taskType?: string;
    planId?: string;
  }) {
    return taskRepository.getAllTasks(userId, filters);
  },

  async createTask(userId: string, data: {
    title: string;
    topic: string;
    difficulty: string;
    platform: string;
    problemUrl?: string;
    taskType?: string;
    scheduledDate: string;
    planId?: string;
  }) {
    return taskRepository.createTask({
      user: { connect: { id: userId } },
      title: data.title,
      topic: data.topic,
      difficulty: data.difficulty,
      platform: data.platform,
      problemUrl: data.problemUrl || null,
      taskType: data.taskType || 'new',
      scheduledDate: new Date(data.scheduledDate),
      ...(data.planId ? { plan: { connect: { id: data.planId } } } : {}),
    });
  },

  async updateTask(taskId: string, userId: string, data: {
    title?: string;
    topic?: string;
    difficulty?: string;
    platform?: string;
    problemUrl?: string;
    scheduledDate?: string;
  }) {
    // Verify ownership
    await this.getTaskById(taskId, userId);

    return taskRepository.updateTask(taskId, {
      ...data,
      ...(data.scheduledDate
        ? { scheduledDate: new Date(data.scheduledDate) }
        : {}),
    });
  },

  async deleteTask(taskId: string, userId: string) {
    await this.getTaskById(taskId, userId);
    return taskRepository.deleteTask(taskId);
  },
};
