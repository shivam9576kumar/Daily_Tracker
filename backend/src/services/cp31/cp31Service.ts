import prisma from '../../config/database';
import { NotFoundError, ValidationError } from '../../utils/error';
import { getCp31Problems, getCp31Bands } from '../plan/cp31SheetLoader';
import { todayKey } from '../../utils/dateKeys';
import { Prisma } from '@prisma/client';

function formatCp31Id(band: number, index: number): string {
  return `cp31-${band}-${String(index).padStart(2, '0')}`;
}

export const cp31Service = {
  /**
   * Derive progress for a band from task rows.
   */
  async deriveProgress(userId: string, band: number) {
    const problems = getCp31Problems(band);
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        taskType: 'cp31',
        cp31ProblemId: { startsWith: `cp31-${band}-` },
      },
    });

    let solved = 0;
    let skipped = 0;
    let nextIndex = 1;

    for (const p of problems) {
      const task = tasks.find((t) => t.cp31ProblemId === p.id);
      if (task?.status === 'completed' && !task.isSkipped) solved++;
      else if (task?.isSkipped) skipped++;
      else if (!task || task.status === 'pending') {
        nextIndex = p.index;
        break;
      }
      nextIndex = p.index + 1;
    }

    return { solved, skipped, nextIndex, total: problems.length };
  },

  /**
   * Materialize up to cp31DailyCount tasks for today.
   * Option B: If there's a pending task from a previous day, don't serve a new one (ladder pauses).
   */
  async ensureCp31TasksForUser(userId: string, tz: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cp31Enabled: true, cp31Band: true, cp31DailyCount: true },
    });

    if (!user?.cp31Enabled || !user.cp31Band) return [];

    const band = user.cp31Band;
    const problems = getCp31Problems(band);
    const todayKeyStr = todayKey(tz);

    // Get all CP31 tasks for this band
    const existing = await prisma.task.findMany({
      where: {
        userId,
        taskType: 'cp31',
        cp31ProblemId: { startsWith: `cp31-${band}-` },
      },
    });

    // Find next unsolved/unskipped index & check for pending carryover
    let nextIndex = 1;
    let pendingCarryOver: typeof existing[number] | null = null;

    for (const p of problems) {
      const task = existing.find((t) => t.cp31ProblemId === p.id);
      if (task?.status === 'completed') {
        nextIndex = p.index + 1;
      } else if (task?.status === 'pending') {
        pendingCarryOver = task;
        break; // Option B: Pause
      } else {
        nextIndex = p.index;
        break;
      }
    }

    // If there's a pending carry-over, return it (ladder paused)
    if (pendingCarryOver) return [pendingCarryOver];

    // Count tasks served today
    const servedToday = existing.filter((t) => t.scheduledDateKey === todayKeyStr).length;

    if (servedToday < user.cp31DailyCount && nextIndex <= problems.length) {
      const problem = problems.find((p) => p.index === nextIndex)!;
      const problemId = formatCp31Id(band, nextIndex);

      try {
        const task = await prisma.task.create({
          data: {
            userId,
            taskType: 'cp31',
            cp31ProblemId: problemId,
            title: problem.title,
            topic: 'Codeforces',
            difficulty: 'medium',
            platform: 'codeforces',
            problemUrl: problem.url,
            status: 'pending',
            scheduledDate: new Date(`${todayKeyStr}T00:00:00.000Z`),
            scheduledDateKey: todayKeyStr,
            planId: null,
          },
        });
        return [task];
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          // Race condition: another request created it. Fetch and return.
          return await prisma.task.findMany({
            where: { userId, taskType: 'cp31', scheduledDateKey: todayKeyStr },
          });
        }
        throw err;
      }
    }

    return [];
  },

  /**
   * Serve one extra problem beyond quota. Cap at 3 extras/day.
   */
  async serveOneMore(userId: string, tz: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cp31Enabled: true, cp31Band: true, cp31DailyCount: true },
    });

    if (!user?.cp31Enabled || !user?.cp31Band) throw new ValidationError('CP31 not enabled');

    const band = user.cp31Band;
    const todayKeyStr = todayKey(tz);
    const existing = await prisma.task.findMany({
      where: { userId, taskType: 'cp31', cp31ProblemId: { startsWith: `cp31-${band}-` } },
    });

    // Check if there is currently a pending task
    const pendingTask = existing.find((t) => t.status === 'pending');
    if (pendingTask) {
      throw new ValidationError('Solve or skip your current CP31 problem first before taking One More');
    }

    const servedToday = existing.filter((t) => t.scheduledDateKey === todayKeyStr).length;
    const extrasUsed = Math.max(0, servedToday - user.cp31DailyCount);

    if (extrasUsed >= 3) throw new ValidationError('One More cap reached for today');

    // Find next index
    let nextIndex = 1;
    const problems = getCp31Problems(band);
    for (const p of problems) {
      const task = existing.find((t) => t.cp31ProblemId === p.id);
      if (!task || (task.status !== 'completed' && !task.isSkipped)) {
        nextIndex = p.index;
        break;
      }
      nextIndex = p.index + 1;
    }

    if (nextIndex > problems.length) throw new ValidationError('Band complete');

    const problem = problems.find((p) => p.index === nextIndex)!;
    const problemId = formatCp31Id(band, nextIndex);

    return prisma.task.create({
      data: {
        userId,
        taskType: 'cp31',
        cp31ProblemId: problemId,
        title: problem.title,
        topic: 'Codeforces',
        difficulty: 'medium',
        platform: 'codeforces',
        problemUrl: problem.url,
        status: 'pending',
        scheduledDate: new Date(`${todayKeyStr}T00:00:00.000Z`),
        scheduledDateKey: todayKeyStr,
        planId: null,
      },
    });
  },

  /**
   * Skip a problem. No coins, ladder advances.
   */
  async skipProblem(userId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId, taskType: 'cp31' },
    });
    if (!task) throw new NotFoundError('CP31 task');
    if (task.status === 'completed') throw new ValidationError('Cannot skip a completed task');

    return prisma.task.update({
      where: { id: taskId },
      data: { isSkipped: true, status: 'completed', completedAt: new Date() },
    });
  },

  /**
   * Advance to next band. Only valid when current band is complete.
   */
  async advanceBand(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cp31Band: true },
    });
    if (!user?.cp31Band) throw new ValidationError('CP31 not enabled');

    const progress = await this.deriveProgress(userId, user.cp31Band);
    if (progress.solved + progress.skipped < progress.total) {
      throw new ValidationError('Band not complete');
    }

    const available = getCp31Bands().map((b) => b.band);
    const currentIdx = available.indexOf(user.cp31Band);
    if (currentIdx === -1 || currentIdx === available.length - 1) {
      throw new ValidationError('No next band available');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { cp31Band: available[currentIdx + 1] },
      select: { cp31Band: true },
    });
  },

  /**
   * Band status for UI.
   */
  async bandStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cp31Enabled: true, cp31Band: true },
    });
    if (!user?.cp31Enabled || !user.cp31Band) return { status: 'none' as const };

    const progress = await this.deriveProgress(userId, user.cp31Band);
    if (progress.solved + progress.skipped >= progress.total) {
      return { status: 'complete-awaiting-confirm' as const, ...progress };
    }
    return { status: 'active' as const, ...progress };
  },
};
