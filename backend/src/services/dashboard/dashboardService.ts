import { taskRepository } from '../../repositories/taskRepository';
import prisma from '../../config/database';
import logger from '../../utils/logger';

/**
 * Dashboard service — aggregates all data for GET /api/dashboard/today
 * in a single call, avoiding 10+ separate API requests from the frontend.
 */
export const dashboardService = {
  async getDashboardData(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Run all queries in parallel
    const [
      todaysTasks,
      statusCounts,
      streak,
      pendingAssignments,
      user,
    ] = await Promise.all([
      taskRepository.getTodaysTasks(userId),
      taskRepository.countByStatus(userId),
      taskRepository.getStreak(userId),
      prisma.assignment.findMany({
        where: { userId, status: 'pending' },
        orderBy: { deadline: 'asc' },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { coins: true },
      }),
    ]);

    // Separate pending and completed tasks
    const pendingTasks = todaysTasks.filter((t) => t.status !== 'completed');
    const completedTasks = todaysTasks.filter((t) => t.status === 'completed');

    // Calculate totals
    const totalQuestions = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    // Generate vibe
    const vibe = getVibe(pendingTasks.length, todaysTasks);

    // Color-code assignments by urgency
    const assignments = pendingAssignments.map((a) => ({
      ...a,
      urgency: getUrgency(a.deadline),
    }));

    return {
      statusOverview: {
        totalQuestions,
        streak,
        backlog: statusCounts.backlog || 0,
        expired: statusCounts.expired || 0,
        coins: user?.coins || 0,
      },
      vibe,
      pendingAssignments: assignments,
      todaysHitlist: {
        pending: pendingTasks,
        completed: completedTasks,
      },
    };
  },
};

/**
 * Generate a vibe message based on today's task load.
 */
function getVibe(
  pendingCount: number,
  tasks: { difficulty: string | null; taskType: string; status: string }[]
) {
  if (pendingCount === 0) {
    return { emoji: '🎉', message: 'All clear! No tasks today. Enjoy your day!', intensity: 'none' as const };
  }

  const hardCount = tasks.filter(
    (t) => t.difficulty === 'hard' && t.status !== 'completed'
  ).length;
  const totalPending = pendingCount;

  if (hardCount >= 3 || totalPending >= 6) {
    return { emoji: '⚔️', message: 'Grind Day! Heavy load ahead. Stay focused!', intensity: 'high' as const };
  }

  if (totalPending >= 3) {
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
