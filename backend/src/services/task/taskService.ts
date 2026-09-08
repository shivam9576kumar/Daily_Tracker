import prisma from '../../config/database';
import { taskRepository } from '../../repositories/taskRepository';
import { NotFoundError, ValidationError } from '../../utils/error';
import { calculateCompletedTaskCoins } from '../../config/rewards';
import { invalidateUserCache } from '../../middleware/authMiddleware';
import { dateKeyInTz } from '../../utils/dateKeys';
import { env } from '../../config/env';
import { resolvePlatformValue } from '../../utils/platform';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const TASK_TYPES = ['new'];

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

  async createTask(userId: string, data: CreateTaskInput, tz?: string) {
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

    const RESERVED_TASK_TYPES = ['potd', 'revision', 'personal', 'cp31'];
    if (data.taskType && RESERVED_TASK_TYPES.includes(data.taskType)) {
      throw new ValidationError('This task type is created automatically and cannot be added manually.');
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

    const scheduledDateKey = /^\d{4}-\d{2}-\d{2}$/.test(data.scheduledDate || '')
      ? data.scheduledDate
      : dateKeyInTz(scheduled, tz || env.DEFAULT_TIMEZONE || 'Asia/Kolkata');

    if (data.problemUrl && !/^https?:\/\//i.test(data.problemUrl)) {
      throw new ValidationError('problemUrl must start with http:// or https://');
    }

    return taskRepository.createTask({
      user: { connect: { id: userId } },
      title: data.title.trim(),
      topic: data.topic.trim(),
      difficulty: data.difficulty || 'medium',
      platform: resolvePlatformValue(data.problemUrl, data.platform || 'custom'),
      problemUrl: data.problemUrl?.trim() || null,
      taskType: data.taskType || 'new',
      scheduledDate: scheduled,
      scheduledDateKey,
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
    },
    tz?: string
  ) {
    const existing = await this.getTaskById(taskId, userId);
    if (existing.taskType === 'cp31') {
      throw new ValidationError('CP31 problems are managed by the ladder and can’t be edited');
    }

    if (data.difficulty && !DIFFICULTIES.includes(data.difficulty)) {
      throw new ValidationError(
        `difficulty must be one of: ${DIFFICULTIES.join(', ')}`
      );
    }

    let scheduledDate: Date | undefined;
    let scheduledDateKey: string | undefined;
    if (data.scheduledDate) {
      scheduledDate = data.scheduledDate.includes('T')
        ? new Date(data.scheduledDate)
        : new Date(`${data.scheduledDate}T00:00:00.000Z`);
      if (isNaN(scheduledDate.getTime())) {
        throw new ValidationError('scheduledDate is not a valid date');
      }
      scheduledDateKey = /^\d{4}-\d{2}-\d{2}$/.test(data.scheduledDate)
        ? data.scheduledDate
        : dateKeyInTz(scheduledDate, tz || env.DEFAULT_TIMEZONE || 'Asia/Kolkata');
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
      ...(scheduledDateKey && { scheduledDateKey }),
    });
  },

  /**
   * Delete a task. If it (or, for a parent, any of its completed revisions) was solved,
   * refund those coins so users.coins always equals "sum of what is currently solved".
   */
  async deleteTask(taskId: string, userId: string) {
    const task = await this.getTaskById(taskId, userId);
    if (task.taskType === 'cp31') {
      throw new ValidationError('CP31 problems are managed by the ladder — use Skip instead of Delete');
    }

    await prisma.$transaction(async (tx) => {
      let refund =
        task.status === 'completed' && task.taskType !== 'personal'
          ? calculateCompletedTaskCoins(task.taskType, task.rating)
          : 0;

      if (task.taskType === 'new') {
        const doneRevs = await tx.task.count({
          where: {
            parentTaskId: taskId,
            taskType: 'revision',
            status: 'completed',
          },
        });

        refund += doneRevs * calculateCompletedTaskCoins('revision');

        await tx.task.deleteMany({
          where: {
            parentTaskId: taskId,
            taskType: 'revision',
          },
        });

        await tx.revision.deleteMany({
          where: {
            parentTaskId: taskId,
          },
        });
      } else if (task.taskType === 'revision') {
        await tx.revision.deleteMany({
          where: {
            revisionTaskId: taskId,
          },
        });
      } else if (task.taskType === 'potd' && task.potdDateKey) {
        await tx.potdDismissal.upsert({
          where: {
            userId_dateKey: {
              userId,
              dateKey: task.potdDateKey,
            },
          },
          create: {
            userId,
            dateKey: task.potdDateKey,
          },
          update: {},
        });
      }

      await tx.task.delete({
        where: { id: taskId },
      });

      if (refund > 0) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { coins: true },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            coins: Math.max(0, (user?.coins ?? 0) - refund),
          },
        });
      }
    });

    invalidateUserCache(userId);

    return { ok: true };
  },

  /** BUG 10: bulk-clear pending/backlog revision tasks. Completed stay (their coins stay). Pending earned 0 coins → no refund. */
  async clearPendingRevisions(userId: string) {
    return prisma.$transaction(async (tx) => {
      const victims = await tx.task.findMany({
        where: { userId, taskType: 'revision', status: { in: ['pending', 'backlog'] } },
        select: { id: true },
      });
      const ids = victims.map((v) => v.id);
      if (ids.length === 0) return { cleared: 0 };
      await tx.revision.deleteMany({ where: { revisionTaskId: { in: ids } } });
      await tx.task.deleteMany({ where: { id: { in: ids } } });
      return { cleared: ids.length };
    });
  },
};
