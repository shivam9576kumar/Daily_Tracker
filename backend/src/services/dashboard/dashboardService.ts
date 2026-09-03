import { taskRepository } from '../../repositories/taskRepository';
import prisma from '../../config/database';
import { streakService } from '../progress/streakService';
import { classesService } from '../classes/classesService';

/**
 * Dashboard service — aggregates all data for GET /api/dashboard/today
 * in a single call, avoiding 10+ separate API requests from the frontend.
 */
export const dashboardService = {
  async getDashboardData(userId: string, tz: string) {
    // Run all queries in parallel
    const [
      todaysTasks,
      totalQuestions,
      backlogCount,
      expiredCount,
      streaks,
      pendingAssignments,
      user,
      classesForWeek,
    ] = await Promise.all([
      taskRepository.getTodaysTasks(userId),
      // Total unique problems actually solved (new tasks only, not revisions)
      prisma.task.count({
        where: { userId, taskType: 'new', status: 'completed' },
      }),
      // Backlog: flagged as backlog, not expired, not completed
      prisma.task.count({
        where: {
          userId,
          isBacklog: true,
          isExpired: false,
          status: { not: 'completed' },
        },
      }),
      // Expired: flagged expired
      prisma.task.count({
        where: { userId, isExpired: true },
      }),
      streakService.getStreaks(userId, tz),
      prisma.assignment.findMany({
        where: { userId, status: 'pending' },
        orderBy: { deadline: 'asc' },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { coins: true },
      }),
      classesService.list(userId).catch(() => []),
    ]);

    const pendingTasks = todaysTasks.filter((t) => t.status !== 'completed');
    const completedTasks = todaysTasks
      .filter((t) => t.status === 'completed')
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)); // newest first

    const vibe = getVibe(pendingTasks.length, completedTasks.length, todaysTasks);

    // Color-code assignments by urgency
    const assignments = pendingAssignments.map((a) => ({
      ...a,
      urgency: getUrgency(a.deadline),
    }));

    return {
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
    };
  },
};

function getVibe(
  pendingCount: number,
  completedCount: number,
  tasks: { difficulty: string | null; taskType: string; status: string; rating: string | null }[]
) {
  if (pendingCount === 0) {
    if (completedCount === 0) {
      return { emoji: '🎉', message: 'All clear! No tasks today. Enjoy your day!', intensity: 'none' as const };
    }
    const unrated = tasks.filter((t) => t.status === 'completed' && t.taskType === 'new' && !t.rating).length;
    return {
      emoji: '🏁',
      message: unrated > 0
        ? `All done for today — ${completedCount} solved · ${unrated} still without a revision plan`
        : `All done for today — ${completedCount} solved. Nice work!`,
      intensity: 'none' as const,
    };
  }

  const hardCount = tasks.filter((t) => t.difficulty === 'hard' && t.status !== 'completed').length;
  if (hardCount >= 3 || pendingCount >= 6) {
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
