import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import type { ProgressScope, TopicProgressData, TopicProgressItem } from './progressTypes';

type DiffKey = 'easy' | 'medium' | 'hard';

export const topicProgressService = {
  /**
   * scope 'auto' → active plan if one exists, else all.
   * Only `new` tasks are counted (revisions are not "problems").
   */
  async getTopicProgress(
    userId: string,
    requested: ProgressScope | 'auto' = 'auto'
  ): Promise<TopicProgressData> {
    const plan = await prisma.plan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    });

    const usePlan = requested !== 'all' && !!plan;
    const where: Prisma.TaskWhereInput = {
      userId,
      taskType: usePlan ? 'new' : { in: ['new', 'potd'] },
      ...(usePlan ? { planId: plan!.id } : {}),
    };

    const [byTopic, byDifficulty] = await Promise.all([
      prisma.task.groupBy({ by: ['topic', 'status'], where, _count: { _all: true } }),
      prisma.task.groupBy({ by: ['difficulty', 'status'], where, _count: { _all: true } }),
    ]);

    const topicMap = new Map<string, TopicProgressItem>();
    for (const row of byTopic) {
      const item = topicMap.get(row.topic) ?? { topic: row.topic, total: 0, solved: 0, percent: 0 };
      item.total += row._count._all;
      if (row.status === 'completed') item.solved += row._count._all;
      topicMap.set(row.topic, item);
    }
    const topics = Array.from(topicMap.values())
      .map((t) => ({ ...t, percent: t.total ? Math.round((t.solved / t.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total || a.topic.localeCompare(b.topic));

    const difficulty = {
      easy: { solved: 0, total: 0 },
      medium: { solved: 0, total: 0 },
      hard: { solved: 0, total: 0 },
    };
    const totals = { solved: 0, total: 0 };
    for (const row of byDifficulty) {
      const raw = row.difficulty ?? 'medium';
      const key: DiffKey = raw === 'easy' || raw === 'hard' ? raw : 'medium';
      difficulty[key].total += row._count._all;
      totals.total += row._count._all;
      if (row.status === 'completed') {
        difficulty[key].solved += row._count._all;
        totals.solved += row._count._all;
      }
    }

    return {
      scope: usePlan ? 'plan' : 'all',
      hasActivePlan: !!plan,
      planId: usePlan ? plan!.id : null,
      planName: plan?.name ?? null,
      topics,
      difficulty,
      totals,
    };
  },
};
