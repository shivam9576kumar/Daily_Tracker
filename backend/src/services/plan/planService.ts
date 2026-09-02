import prisma from '../../config/database';

export const planService = {
  async getActivePlan(userId: string) {
    const plan = await prisma.plan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan) return null;

    const tasks = await prisma.task.findMany({
      where: { userId, planId: plan.id },
      orderBy: [
        { scheduledDate: 'asc' },
        { taskType: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return { plan, tasks };
  },
};
