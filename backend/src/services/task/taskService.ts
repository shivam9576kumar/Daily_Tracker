import prisma from '../../config/database';
import { taskRepository } from '../../repositories/taskRepository';
import { NotFoundError, ValidationError } from '../../utils/error';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const TASK_TYPES = ['new', 'assignment'];

export interface CreateTaskInput {
  title: string;
  topic: string;
  difficulty?: string;
  platform?: string;
  problemUrl?: string;
  taskType?: string;
  scheduledDate: string;
  planId?: string;
}

/**
 * Core task service — CRUD operations and validation.
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

  async getAllTasks(
    userId: string,
    filters?: {
      status?: string;
      topic?: string;
      taskType?: string;
      planId?: string;
    }
  ) {
    return taskRepository.getAllTasks(userId, filters);
  },

  async createTask(userId: string, data: CreateTaskInput) {
    // ─── Validation ───
    if (!data.title || !data.title.trim()) {
      throw new ValidationError('Title is required');
    }

    if (data.title.length > 200) {
      throw new ValidationError('Title must be under 200 characters');
    }

    if (!data.topic || !data.topic.trim()) {
      throw new ValidationError('Topic is required');
    }

    if (data.difficulty && !DIFFICULTIES.includes(data.difficulty)) {
      throw new ValidationError(
        `difficulty must be one of: ${DIFFICULTIES.join(', ')}`
      );
    }

    if (data.taskType === 'revision') {
      throw new ValidationError(
        'Revision tasks cannot be created manually. Complete a new task to generate revisions.'
      );
    }

    if (data.taskType && !TASK_TYPES.includes(data.taskType)) {
      throw new ValidationError(
        `taskType must be one of: ${TASK_TYPES.join(', ')}`
      );
    }

    const scheduled = data.scheduledDate
      ? (data.scheduledDate.includes('T')
          ? new Date(data.scheduledDate)
          : new Date(`${data.scheduledDate}T00:00:00.000Z`))
      : new Date();
    if (isNaN(scheduled.getTime())) {
      throw new ValidationError('scheduledDate is not a valid date');
    }

    if (data.problemUrl && !/^https?:\/\//i.test(data.problemUrl)) {
      throw new ValidationError('problemUrl must start with http:// or https://');
    }

    return taskRepository.createTask({
      user: { connect: { id: userId } },
      title: data.title.trim(),
      topic: data.topic.trim(),
      difficulty: data.difficulty || 'medium',
      platform: data.platform || 'custom',
      problemUrl: data.problemUrl?.trim() || null,
      taskType: data.taskType || 'new',
      scheduledDate: scheduled,
      ...(data.planId ? { plan: { connect: { id: data.planId } } } : {}),
    });
  },

  async updateTask(
    taskId: string,
    userId: string,
    data: {
      title?: string;
      topic?: string;
      difficulty?: string;
      platform?: string;
      problemUrl?: string;
      scheduledDate?: string;
    }
  ) {
    await this.getTaskById(taskId, userId);

    if (data.difficulty && !DIFFICULTIES.includes(data.difficulty)) {
      throw new ValidationError(
        `difficulty must be one of: ${DIFFICULTIES.join(', ')}`
      );
    }

    let scheduledDate: Date | undefined;
    if (data.scheduledDate) {
      scheduledDate = data.scheduledDate.includes('T')
        ? new Date(data.scheduledDate)
        : new Date(`${data.scheduledDate}T00:00:00.000Z`);
      if (isNaN(scheduledDate.getTime())) {
        throw new ValidationError('scheduledDate is not a valid date');
      }
    }

    return taskRepository.updateTask(taskId, {
      ...(data.title && { title: data.title.trim() }),
      ...(data.topic && { topic: data.topic.trim() }),
      ...(data.difficulty && { difficulty: data.difficulty }),
      ...(data.platform && { platform: data.platform }),
      ...(data.problemUrl !== undefined && {
        problemUrl: data.problemUrl || null,
      }),
      ...(scheduledDate && { scheduledDate }),
    });
  },

  async deleteTask(taskId: string, userId: string) {
    const task = await this.getTaskById(taskId, userId);

    /**
     * If deleting a parent/new task, delete all child revision tasks first.
     * This prevents orphan revision tasks.
     */
    if (task.taskType === 'new') {
      await prisma.task.deleteMany({
        where: {
          parentTaskId: taskId,
          taskType: 'revision',
        },
      });

      await prisma.revision.deleteMany({
        where: {
          parentTaskId: taskId,
        },
      });
    }

    return taskRepository.deleteTask(taskId);
  },
};
