import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { todayKey } from '../utils/dateKeys';

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
   * Get today's tasks plus any backlog tasks in the user's timezone.
   */
  /**
   * Today's hitlist = three things:
   *   1. anything scheduled today (any status)
   *   2. open backlog (overdue, not expired, not solved)
   *   3. anything SOLVED TODAY — by completedAt — regardless of when it was scheduled.
   *      Without (3) a backlog item vanishes the moment you solve it. (3) also makes
   *      "Completed Today" clear itself at midnight: the window simply moves.
   */
  async getTodaysTasks(userId: string, tz?: string) {
    const currentKey = todayKey(tz);
    const [yStr, mStr, dStr] = currentKey.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const day = parseInt(dStr, 10);

    // Center the window on local noon UTC, then expand 18h in each direction to cover all timezone offsets
    const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const startWindow = new Date(noonUTC.getTime() - 18 * 60 * 60 * 1000);
    const endWindow = new Date(noonUTC.getTime() + 18 * 60 * 60 * 1000);

    return prisma.task.findMany({
      where: {
        userId,
        isExpired: false,
        AND: [
          {
            OR: [
              // scheduled today (in local timezone window)
              { scheduledDate: { gte: startWindow, lte: endWindow } },
              // open backlog
              { isBacklog: true, status: 'backlog' },
              // completed today (in local timezone window)
              { status: 'completed', completedAt: { gte: startWindow, lte: endWindow } },
            ],
          },
          // ── LEAK FIX: ignore archived plans ──
          {
            OR: [
              { planId: null },
              { plan: { status: 'active' } },
            ],
          },
        ],
      },
      orderBy: [{ status: 'asc' }, { isBacklog: 'desc' }, { taskType: 'asc' }, { scheduledDate: 'asc' }],
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
        completedAt: null,
        scheduledDate: {
          lt: today,
        },
        OR: [{ planId: null }, { plan: { status: 'active' } }],
      },
    });
  },

  /**
   * Find backlog tasks that have been in backlog for over N days.
   * Used by the expiry cron job.
   */
  async findExpiredBacklogTasks(expiryDays: number) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - expiryDays);

    return prisma.task.findMany({
      where: {
        isBacklog: true,
        isExpired: false,
        status: {
          not: 'completed',
        },
        backlogSince: {
          lte: cutoff,
        },
        OR: [{ planId: null }, { plan: { status: 'active' } }],
      },
    });
  },

  /**
   * Get revision progress summary for a parent task.
   */
  async getRevisionProgress(parentTaskId: string) {
    const total = await prisma.revision.count({
      where: { parentTaskId },
    });

    const completed = await prisma.revision.count({
      where: {
        parentTaskId,
        status: 'completed',
      },
    });

    const pending = await prisma.revision.count({
      where: {
        parentTaskId,
        status: {
          not: 'completed',
        },
      },
    });

    return {
      total,
      completed,
      pending,
    };
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
};

