import prisma from '../../config/database';
import { NotFoundError, ValidationError } from '../../utils/error';

function startOfToday(): Date {
  const d = new Date(); d.setHours(0,0,0,0); return d;
}
function minusDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() - n); return x;
}

export const planService = {
  async getActivePlan(userId: string) {
    const plan = await prisma.plan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    const today = startOfToday();
    const origin = plan ? new Date(Math.min(new Date(plan.startDate).getTime(), today.getTime())) : today;

    const [tasks, revisions] = await Promise.all([
      plan ? prisma.task.findMany({
        where: { userId, planId: plan.id, taskType: { not: 'revision' } },
        orderBy: { scheduledDate: 'asc' },
      }) : Promise.resolve([]),
      prisma.task.findMany({
        where: {
          userId,
          taskType: 'revision',
          isExpired: false,
          scheduledDate: { gte: minusDays(origin, 1) },
          OR: [{ planId: null }, { plan: { status: 'active' } }],
        },
        orderBy: [{ scheduledDate: 'asc' }, { revisionNumber: 'asc' }],
      }),
    ]);

    return { plan, tasks, revisions, origin: origin.toISOString() };
  },

  async getArchivedPlans(userId: string) {
    const plans = await prisma.plan.findMany({
      where: { userId, status: 'archived' },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(plans.map(async (p) => {
      const total = await prisma.task.count({ where: { userId, planId: p.id, taskType: { not: 'revision' } } });
      const solved = await prisma.task.count({ where: { userId, planId: p.id, taskType: { not: 'revision' }, status: 'completed' } });
      const revPending = await prisma.task.count({ where: { userId, planId: p.id, taskType: 'revision', status: { not: 'completed' } } });
      return {
        ...p,
        progress: { total, solved, revPending },
      };
    }));
  },

  async restorePlan(userId: string, planId: string) {
    const target = await prisma.plan.findFirst({ where: { id: planId, userId } });
    if (!target) throw new NotFoundError('Plan');
    if (target.status === 'active') throw new ValidationError('Plan is already active');

    return prisma.$transaction(async (tx) => {
      // Archive current active plan if any
      await tx.plan.updateMany({
        where: { userId, status: 'active' },
        data: { status: 'archived' },
      });

      // Activate target plan
      await tx.plan.update({
        where: { id: planId },
        data: { status: 'active' },
      });

      return tx.plan.findUnique({ where: { id: planId } });
    });
  },

  /**
   * Delete a plan.
   * Locked product rule: remove the plan and unfinished NEW plan work.
   * Keep everything the student already earned or already scheduled as a revision.
   *  - completed parents stay (planId = null)
   *  - all revision tasks stay (planId = null)
   *  - only unfinished new plan work is deleted
   *  - plan row deleted
   */
  async deletePlan(userId: string, planId: string) {
    const plan = await prisma.plan.findFirst({ where: { id: planId, userId } });
    if (!plan) throw new NotFoundError('Plan');

    return prisma.$transaction(async (tx) => {
      // 1. Detach completed parents (history)
      await tx.task.updateMany({
        where: { planId, userId, status: 'completed' },
        data: { planId: null },
      });

      // 2. Detach ALL revision tasks that belong to this plan (keep rows)
      await tx.task.updateMany({
        where: { planId, userId, taskType: 'revision' },
        data: { planId: null },
      });

      // 3. Delete only unfinished NEW plan work (not revisions, not completed)
      await tx.task.deleteMany({
        where: {
          planId,
          userId,
          taskType: { not: 'revision' },
          status: { in: ['pending', 'backlog', 'expired'] },
        },
      });

      // 4. Delete the plan row
      await tx.plan.delete({ where: { id: planId } });

      return { ok: true };
    });
  },
};
