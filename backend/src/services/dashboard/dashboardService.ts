import { taskRepository } from '../../repositories/taskRepository';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { streakService } from '../progress/streakService';
import { classesService } from '../classes/classesService';
import { ensurePotdTaskForUser } from '../potd/potdService';
import { computePotdStreak, type PotdStreakResult } from '../potd/potdStreakService';
import { ensureCp31TasksForUser, emptyCp31State, listSkippedCp31, type Cp31State } from '../cp31/cp31Service';
import { computeCp31Streak, type Cp31StreakResult } from '../cp31/cp31StreakService';

/**
 * Dashboard service — aggregates all data for GET /api/dashboard/today
 * in a single call, avoiding 10+ separate API requests from the frontend.
 */
export const dashboardService = {
  async getDashboardData(userId: string, tz: string) {
    let ensuredPotd: Awaited<ReturnType<typeof ensurePotdTaskForUser>> = {
      enabled: true,
      taskId: null,
      potd: null,
      stale: false,
    };
    try {
      ensuredPotd = await ensurePotdTaskForUser(userId, tz);
    } catch (err) {
      logger.warn('dashboardService: POTD ensure failed, continuing without it', {
        message: (err as Error)?.message,
      });
    }

    const potdMeta = ensuredPotd.potd
      ? { dateKey: ensuredPotd.potd.dateKey, stale: ensuredPotd.stale }
      : null;

    let potdStreak: PotdStreakResult | null = null;
    try {
      potdStreak = await computePotdStreak(userId, tz);
    } catch (err) {
      logger.warn('dashboardService: POTD streak computation failed', {
        message: (err as Error)?.message,
      });
    }

    let cp31State: Cp31State = emptyCp31State();
    let cp31Streak: Cp31StreakResult | null = null;
    let cp31SkippedCount = 0;
    try {
      cp31State = await ensureCp31TasksForUser(userId, tz);
      cp31Streak = await computeCp31Streak(userId, tz);
      const skipped = await listSkippedCp31(userId, cp31State.band ?? undefined);
      cp31SkippedCount = skipped.length;
    } catch (err) {
      logger.warn('dashboardService: CP31 ensure/streak failed, continuing', {
        message: (err as Error)?.message,
      });
    }

    // Run queries in small batches to stay well under the pool size limit (15)
    const [todaysTasks, totalQuestions, user, activePlan] = await Promise.all([
      taskRepository.getTodaysTasks(userId, tz, ensuredPotd.potd?.dateKey ?? null),
      // Total unique problems actually solved (new tasks + potd + cp31, not revisions)
      prisma.task.count({
        where: { userId, taskType: { in: ['new', 'potd', 'cp31'] }, status: 'completed' },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { coins: true },
      }),
      prisma.plan.findFirst({
        where: { userId, status: 'active' },
        select: { id: true, name: true },
      }),
    ]);

    const [backlogCount, expiredCount, streaks, pendingAssignments, classesForWeek] = await Promise.all([
      // Backlog: flagged as backlog, not expired, not completed (live plan or manual)
      prisma.task.count({
        where: {
          userId,
          isBacklog: true,
          isExpired: false,
          status: { not: 'completed' },
          OR: [{ planId: null }, { plan: { status: 'active' } }],
        },
      }),
      // Expired: flagged expired (live plan or manual)
      prisma.task.count({
        where: {
          userId,
          isExpired: true,
          OR: [{ planId: null }, { plan: { status: 'active' } }],
        },
      }),
      streakService.getStreaks(userId, tz),
      prisma.assignment.findMany({
        where: { userId, status: 'pending' },
        orderBy: { deadline: 'asc' },
      }),
      classesService.list(userId).catch(() => []),
    ]);

    const pendingTasks = todaysTasks.filter((t) => t.status !== 'completed');
    const completedTasks = todaysTasks
      .filter((t) => t.status === 'completed')
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)); // newest first

    const vibe = getVibe(pendingTasks.length, completedTasks.length, !!activePlan);

    // Color-code assignments by urgency
    const assignments = pendingAssignments.map((a) => ({
      ...a,
      urgency: getUrgency(a.deadline),
    }));

    return {
      hasActivePlan: !!activePlan,
      activePlan: activePlan ?? null,
      statusOverview: {
        totalQuestions,
        streak: streaks.current,
        streakActiveToday: streaks.activeToday,
        backlog: backlogCount,
        expired: expiredCount,
        coins: user?.coins || 0,
      },
      vibe,
      pendingAssignments: assignments,
      todaysHitlist: {
        pending: pendingTasks,
        completed: completedTasks,
      },
      classes: classesForWeek,
      potd: potdMeta,
      potdStreak,
      dailyChallenges: {
        potd: { enabled: ensuredPotd.enabled },
        cp31: { ...cp31State, skippedCount: cp31SkippedCount },
      },
      cp31Streak,
    };
  },
};

function getVibe(
  pendingCount: number,
  completedCount: number,
  hasActivePlan: boolean = true,
) {
  if (pendingCount === 0) {
    if (completedCount === 0) {
      if (!hasActivePlan) {
        return { emoji: '🌱', message: 'No active plan. Generate a plan to get a daily hitlist.', intensity: 'none' as const };
      }
      return { emoji: '🎉', message: 'All clear! No tasks today. Enjoy your day!', intensity: 'none' as const };
    }
    return {
      emoji: '🏁',
      message: `All done for today — ${completedCount} solved. Nice work!`,
      intensity: 'none' as const,
    };
  }

  if (pendingCount >= 6) {
    return { emoji: '⚔️', message: 'Grind Day! Heavy load ahead. Stay focused!', intensity: 'high' as const };
  }
  if (pendingCount >= 3) {
    return { emoji: '💪', message: 'Solid day! A good mix of challenges awaits.', intensity: 'medium' as const };
  }
  return { emoji: '🌤️', message: 'Light day! Quick and easy. Keep the streak alive!', intensity: 'low' as const };
}

/**
 * Determine assignment urgency based on deadline.
 */
function getUrgency(deadline: Date): 'today' | 'tomorrow' | 'future' {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  return 'future';
}
