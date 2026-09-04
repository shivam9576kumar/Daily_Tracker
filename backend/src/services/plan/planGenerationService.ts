import prisma from '../../config/database';
import { QuestionBankEntry, loadQuestionBank } from './questionBankLoader';
import { calculateDailyCapacities, BusyDayInput } from './capacityCalculator';
import { scheduleQuestions, SchedulerResult, TopicQuota } from './weightedScheduler';
import { todayKey } from '../../utils/dateKeys';
import { NotFoundError, ValidationError } from '../../utils/error';

export interface GeneratePlanInput {
  name?: string;
  source: 'neetcode150' | 'coderarmy';
  startDate: string;
  durationDays: number;
  pace: 'relaxed' | 'moderate' | 'intensive' | 'custom';
  weekdayLoad: number;
  weekendLoad: number;
  topicQuotas?: TopicQuota[];
  focusTopics?: string[];
  avoidTopics?: string[];
  busyDays?: BusyDayInput[];
  bufferDay?: number;
  archiveExisting?: boolean;
}

export const planGenerationService = {
  /**
   * Preview a generated plan without writing to database.
   */
  async previewPlan(
    input: GeneratePlanInput
  ): Promise<SchedulerResult> {
    const {
      source = 'neetcode150',
      startDate = todayKey(),
      durationDays = 14,
      weekdayLoad = 2.0,
      weekendLoad = 3.0,
      topicQuotas,
      focusTopics = [],
      avoidTopics = [],
      busyDays = [],
      bufferDay = 0,
    } = input;

    if (durationDays < 1 || durationDays > 365) {
      throw new ValidationError('durationDays must be between 1 and 365');
    }

    if (weekdayLoad <= 0 || weekendLoad <= 0) {
      throw new ValidationError('weekdayLoad and weekendLoad must be positive numbers');
    }

    const questions = loadQuestionBank(source);
    const capacities = calculateDailyCapacities({
      startDate,
      durationDays,
      weekdayLoad,
      weekendLoad,
      busyDays,
      bufferDay,
    });

    const result = scheduleQuestions({
      source,
      questions,
      capacities,
      topicQuotas,
      focusTopics,
      avoidTopics,
      weekdayLoad,
      weekendLoad,
    });

    return result;
  },

  /**
   * Commit a generated plan into database (creates Plan + Tasks).
   */
  async commitPlan(userId: string, input: GeneratePlanInput) {
    const preview = await this.previewPlan(input);

    if (!preview.valid) {
      throw new ValidationError(
        preview.errors.join(' ') ||
          'Plan schedule is invalid. Please adjust duration or daily load.'
      );
    }

    const existingActive = await prisma.plan.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (existingActive && !input.archiveExisting) {
      throw new ValidationError(
        'You already have an active plan. Archive existing plan or pass archiveExisting: true.'
      );
    }

    const defaultTitle = input.source === 'coderarmy' ? 'Coder Army' : 'NeetCode 150';
    const planName =
      input.name?.trim() || `${defaultTitle} - ${input.durationDays} Day Plan`;
    const startDate = new Date(`${preview.summary.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${preview.summary.endDate}T23:59:59.999Z`);

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Archive existing active plan if requested
        if (existingActive && input.archiveExisting) {
          await tx.plan.update({
            where: { id: existingActive.id },
            data: { status: 'archived' },
          });
        }

        // 2. Create the new Plan
        const plan = await tx.plan.create({
          data: {
            userId,
            name: planName,
            source: input.source || 'neetcode150',
            startDate,
            endDate,
            status: 'active',
            weekdayCapacity: Math.round(preview.summary.weekdayLoad),
            weekendCapacity: Math.round(preview.summary.weekendLoad),
          },
        });

        // 3. Batch insert tasks
        const tasksData: any[] = [];
        for (const day of preview.days) {
          const scheduledDate = new Date(`${day.date}T00:00:00.000Z`);

          for (const q of day.questions) {
            tasksData.push({
              userId,
              planId: plan.id,
              title: q.question.title,
              topic: q.question.topic,
              difficulty: q.question.difficulty,
              platform: 'leetcode',
              problemUrl: q.question.url || null,
              taskType: 'new',
              status: 'pending',
              scheduledDate,
            });
          }
        }

        if (tasksData.length > 0) {
          await tx.task.createMany({
            data: tasksData,
          });
        }

        return {
          plan,
          tasksCreated: tasksData.length,
        };
      },
      {
        timeout: 15000,
      }
    );

    return result;
  },

  /**
   * Get the current active plan with all linked tasks.
   */
  async getActivePlan(userId: string) {
    const plan = await prisma.plan.findFirst({
      where: {
        userId,
        status: 'active',
      },
      include: {
        tasks: {
          orderBy: [
            { scheduledDate: 'asc' },
            { taskType: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
    });

    return plan;
  },

  /**
   * Archive an existing plan.
   */
  async archivePlan(userId: string, planId: string) {
    const plan = await prisma.plan.findFirst({
      where: {
        id: planId,
        userId,
      },
    });

    if (!plan) {
      throw new NotFoundError('Plan');
    }

    const updated = await prisma.plan.update({
      where: { id: planId },
      data: { status: 'archived' },
    });

    return updated;
  },
};
