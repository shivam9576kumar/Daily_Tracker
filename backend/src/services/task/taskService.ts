import prisma from '../../config/database';
import { taskRepository } from '../../repositories/taskRepository';
import { NotFoundError, ValidationError } from '../../utils/error';
import { calculateCoins } from '../../config/rewards';

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
  async getTodaysTasks(userId: string, tz?: string) {
    return taskRepository.getTodaysTasks(userId, tz);
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

  /**
   * Delete a task. If it (or, for a parent, any of its completed revisions) was solved,
   * refund those coins so users.coins always equals "sum of what is currently solved".
   */
  async deleteTask(taskId: string, userId: string) {
    const task = await this.getTaskById(taskId, userId);

    await prisma.$transaction(async (tx) => {
      let refund = task.status === 'completed' ? calculateCoins(task.taskType, task.difficulty) : 0;

      if (task.taskType === 'new') {
        const doneRevs = await tx.task.count({
          where: { parentTaskId: taskId, taskType: 'revision', status: 'completed' },
        });
        refund += doneRevs * calculateCoins('revision', null);
        await tx.task.deleteMany({ where: { parentTaskId: taskId, taskType: 'revision' } });
        await tx.revision.deleteMany({ where: { parentTaskId: taskId } });
      } else if (task.taskType === 'revision') {
        await tx.revision.deleteMany({ where: { revisionTaskId: taskId } });
      }

      await tx.task.delete({ where: { id: taskId } });

      if (refund > 0) {
        const u = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
        await tx.user.update({ where: { id: userId }, data: { coins: Math.max(0, (u?.coins ?? 0) - refund) } });
      }
    });

    return { ok: true };
  },
};
