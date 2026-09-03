import prisma from '../../config/database';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function minusDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - n);
  return x;
}

export const planService = {
  /**
   * Roadmap payload.
   *
   *  plan      → the active plan, or null
   *  tasks     → that plan's own PROBLEMS (taskType != 'revision'), any status
   *  revisions → ALL revision tasks for this user — from plan problems AND from
   *              manually-added problems, from any plan — not expired, dated on/after `origin`
   *  origin    → where Roadmap "Week 1" starts = the earlier of plan.startDate and today
   *              (so revisions due before a future-dated plan starts are still visible)
   *
   * The DB filter is padded by one day so timezone rounding can never drop a
   * same-day revision; the frontend clamps anything before origin into week 1.
   */
  async getActivePlan(userId: string) {
    const plan = await prisma.plan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    const today = startOfToday();
    const origin = plan
      ? new Date(Math.min(new Date(plan.startDate).getTime(), today.getTime()))
      : today;

    const [tasks, revisions] = await Promise.all([
      plan
        ? prisma.task.findMany({
            where: { userId, planId: plan.id, taskType: { not: 'revision' } },
            orderBy: { scheduledDate: 'asc' },
          })
        : Promise.resolve([]),
      prisma.task.findMany({
        where: {
          userId,
          taskType: 'revision',
          isExpired: false,
          scheduledDate: { gte: minusDays(origin, 1) },
        },
        orderBy: [{ scheduledDate: 'asc' }, { revisionNumber: 'asc' }],
      }),
    ]);

    return { plan, tasks, revisions, origin: origin.toISOString() };
  },
};
