import prisma from '../config/database';
import { Prisma } from '@prisma/client';

/**
 * Task Repository — data access layer for the tasks table.
 * All database queries for tasks go through here.
 */
export const taskRepository = {
  /**
   * Get all tasks for a user scheduled for a specific date.
   */
  async getTasksByDate(userId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return prisma.task.findMany({
      where: {
        userId,
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: [
        { status: 'asc' },      // pending first
        { taskType: 'asc' },     // new before revision
        { difficulty: 'desc' },  // hard first
      ],
    });
  },

  /**
   * Get today's tasks plus any backlog tasks.
   */
  async getTodaysTasks(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return prisma.task.findMany({
      where: {
        userId,
        OR: [
          // Tasks scheduled for today
          {
            scheduledDate: { gte: today, lte: endOfToday },
          },
          // Backlog tasks (overdue but not expired)
          {
            isBacklog: true,
            isExpired: false,
            status: 'pending',
          },
        ],
      },
      orderBy: [
        { status: 'asc' },
        { isBacklog: 'desc' },
        { taskType: 'asc' },
        { scheduledDate: 'asc' },
      ],
    });
  },

  /**
   * Get a single task by ID, ensuring it belongs to the user.
   */
  async getTaskById(taskId: string, userId: string) {
    return prisma.task.findFirst({
      where: { id: taskId, userId },
      include: {
        revisions: {
          orderBy: { revisionNumber: 'asc' },
        },
        parentTask: true,
        taskNotes: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });
  },

  /**
   * Create a new task.
   */
  async createTask(data: Prisma.TaskCreateInput) {
    return prisma.task.create({ data });
  },

  /**
   * Update a task.
   */
  async updateTask(taskId: string, data: Prisma.TaskUpdateInput) {
    return prisma.task.update({
      where: { id: taskId },
      data,
    });
  },

  /**
   * Delete a task.
   */
  async deleteTask(taskId: string) {
    return prisma.task.delete({ where: { id: taskId } });
  },

  /**
   * Get all tasks for a user.
   */
  async getAllTasks(userId: string, filters?: {
    status?: string;
    topic?: string;
    taskType?: string;
    planId?: string;
  }) {
    const where: Prisma.TaskWhereInput = { userId };

    if (filters?.status) where.status = filters.status;
    if (filters?.topic) where.topic = filters.topic;
    if (filters?.taskType) where.taskType = filters.taskType;
    if (filters?.planId) where.planId = filters.planId;

    return prisma.task.findMany({
      where,
      orderBy: { scheduledDate: 'asc' },
    });
  },

  /**
   * Count tasks by status for a user.
   */
  async countByStatus(userId: string) {
    const counts = await prisma.task.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
    });

    const result: Record<string, number> = {
      pending: 0,
      completed: 0,
      backlog: 0,
      expired: 0,
    };

    for (const row of counts) {
      result[row.status] = row._count.id;
    }

    return result;
  },

  /**
   * Get completed tasks count by date for heatmap.
   */
  async getCompletionsByDate(userId: string, startDate: Date, endDate: Date) {
    return prisma.task.groupBy({
      by: ['completedAt'],
      where: {
        userId,
        status: 'completed',
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: { id: true },
    });
  },

  /**
   * Find pending tasks that are overdue (scheduled before today).
   * Used by the backlog cron job.
   */
  async findOverduePendingTasks() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.task.findMany({
      where: {
        status: 'pending',
        isBacklog: false,
        isExpired: false,
        scheduledDate: { lt: today },
      },
    });
  },

  /**
   * Find backlog tasks that have been in backlog for over N days.
   * Used by the expiry cron job.
   */
  async findExpiredBacklogTasks(expiryDays: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - expiryDays);

    return prisma.task.findMany({
      where: {
        isBacklog: true,
        isExpired: false,
        backlogSince: { lte: cutoff },
      },
    });
  },

  /**
   * Get revision tasks for a parent task.
   */
  async getRevisionsByParentId(parentTaskId: string) {
    return prisma.task.findMany({
      where: { parentTaskId },
      orderBy: { revisionNumber: 'asc' },
    });
  },

  /**
   * Delete all pending revision tasks for a parent task.
   */
  async deletePendingRevisions(parentTaskId: string) {
    return prisma.task.deleteMany({
      where: {
        parentTaskId,
        taskType: 'revision',
        status: 'pending',
      },
    });
  },

  /**
   * Get streak — consecutive days with completions going back from today.
   */
  async getStreak(userId: string): Promise<number> {
    // Get all distinct completion dates, ordered descending
    const completions = await prisma.$queryRaw<{ date: Date }[]>`
      SELECT DISTINCT DATE(completed_at) as date
      FROM tasks
      WHERE user_id = ${userId}
        AND status = 'completed'
        AND completed_at IS NOT NULL
      ORDER BY date DESC
    `;

    if (completions.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < completions.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      expected.setHours(0, 0, 0, 0);

      const actual = new Date(completions[i].date);
      actual.setHours(0, 0, 0, 0);

      if (actual.getTime() === expected.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  },
};
