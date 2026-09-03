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

    // Attach progress per plan
    const withProgress = await Promise.all(plans.map(async (p) => {
      const total = await prisma.task.count({ where: { userId, planId: p.id, taskType: { not: 'revision' } } });
      const solved = await prisma.task.count({ where: { userId, planId: p.id, taskType: { not: 'revision' }, status: 'completed' } });
      const revPending = await prisma.task.count({ where: { userId, planId: p.id, taskType: 'revision', status: { not: 'completed' } } });
      return { ...p, progress: { total, solved, revPending } };
    }));

    return withProgress;
  },

  async restorePlan(userId: string, planId: string) {
    const target = await prisma.plan.findFirst({ where: { id: planId, userId } });
    if (!target) throw new NotFoundError('Plan');
    if (target.status === 'active') throw new ValidationError('Plan is already active');

    return prisma.$transaction(async (tx) => {
      // Archive current active
      await tx.plan.updateMany({
        where: { userId, status: 'active' },
        data: { status: 'archived' },
      });
      // Activate target
      await tx.plan.update({
        where: { id: planId },
        data: { status: 'active' },
      });
      return tx.plan.findUnique({ where: { id: planId } });
    });
  },

  /**
   * Delete plan X:
   * - keep completed tasks as history (planId=null, rating=null)
   * - delete all pending tasks + pending revision records
   * - coins are KEPT (no refund)
   */
  async deletePlan(userId: string, planId: string) {
    const plan = await prisma.plan.findFirst({ where: { id: planId, userId } });
    if (!plan) throw new NotFoundError('Plan');

    return prisma.$transaction(async (tx) => {
      // All task ids belonging to this plan
      const allPlanTasks = await tx.task.findMany({
        where: { userId, planId },
        select: { id: true, status: true, taskType: true },
      });

      const completedIds = allPlanTasks.filter(t => t.status === 'completed').map(t => t.id);
      const pendingIds   = allPlanTasks.filter(t => t.status !== 'completed').map(t => t.id);

      // 1. For completed parents, delete their PENDING revisions (both tasks and records)
      if (completedIds.length) {
        // Pending revision TASKS whose parent is a completed plan task
        const pendingRevTasks = await tx.task.findMany({
          where: { userId, parentTaskId: { in: completedIds }, status: { not: 'completed' } },
          select: { id: true },
        });
        const pendingRevTaskIds = pendingRevTasks.map(t => t.id);

        if (pendingRevTaskIds.length) {
          await tx.revision.deleteMany({ where: { revisionTaskId: { in: pendingRevTaskIds } } });
          await tx.task.deleteMany({ where: { id: { in: pendingRevTaskIds } } });
        }

        await tx.revision.deleteMany({
          where: { parentTaskId: { in: completedIds }, status: { not: 'completed' } },
        });

        // Detach completed plan tasks as history
        await tx.task.updateMany({
          where: { id: { in: completedIds } },
          data: { planId: null, rating: null },
        });
      }

      // 2. Delete all pending plan tasks + their revision records
      if (pendingIds.length) {
        await tx.revision.deleteMany({
          where: {
            OR: [
              { parentTaskId: { in: pendingIds } },
              { revisionTaskId: { in: pendingIds } },
            ],
          },
        });
        await tx.task.deleteMany({ where: { id: { in: pendingIds } } });
      }

      // 3. Delete the plan row
      await tx.plan.delete({ where: { id: planId } });

      return { deletedPending: pendingIds.length, keptCompleted: completedIds.length };
    });
  },
};
