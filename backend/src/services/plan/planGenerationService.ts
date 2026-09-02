import prisma from '../../config/database';
import { loadQuestionBank } from './questionBankLoader';
import { calculateDailyCapacities, BusyDayInput } from './capacityCalculator';
import { scheduleQuestions, SchedulerResult } from './weightedScheduler';
import { NotFoundError, ValidationError } from '../../utils/error';
import logger from '../../utils/logger';

export interface GeneratePlanInput {
  name?: string;
  source: 'neetcode150';
  startDate: string;
  durationDays: number;
  pace: 'relaxed' | 'moderate' | 'intensive' | 'custom';
  weekdayLoad: number;
  weekendLoad: number;
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
  async previewPlan(input: GeneratePlanInput): Promise<SchedulerResult> {
    const {
      source = 'neetcode150',
      startDate = new Date().toISOString().split('T')[0],
      durationDays = 14,
      weekdayLoad = 2.0,
      weekendLoad = 3.0,
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
        preview.errors.join(' ') || 'Plan schedule is invalid. Please adjust duration or daily load.'
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

    const planName = input.name?.trim() || `NeetCode 150 - ${input.durationDays} Day Plan`;
    const startDate = new Date(`${preview.summary.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${preview.summary.endDate}T23:59:59.999Z`);

    const result = await prisma.$transaction(
      async (tx) => {
        // Archive existing active plans if requested
        if (existingActive && input.archiveExisting) {
          await tx.plan.updateMany({
            where: {
              userId,
              status: 'active',
            },
            data: {
              status: 'archived',
            },
          });
        }

        // Create Plan
        const plan = await tx.plan.create({
          data: {
            userId,
            name: planName,
            source: input.source,
            startDate,
            endDate,
            status: 'active',
            weekdayCapacity: Math.round(input.weekdayLoad),
            weekendCapacity: Math.round(input.weekendLoad),
          },
        });

        // Flatten all scheduled questions into Task rows for batch insertion
        const tasksData = [];
        for (const day of preview.days) {
          for (const sq of day.questions) {
            const scheduledDate = new Date(`${sq.scheduledDate}T00:00:00.000Z`);
            tasksData.push({
              userId,
              planId: plan.id,
              title: sq.question.title,
              topic: sq.question.topic,
              difficulty: sq.question.difficulty,
              platform: 'leetcode',
              problemUrl: sq.question.url,
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

        logger.info(
          `✅ Created Plan "${plan.name}" (ID: ${plan.id}) with ${tasksData.length} tasks for user ${userId}`
        );

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

    await prisma.plan.update({
      where: { id: planId },
      data: { status: 'archived' },
    });

    return { message: 'Plan archived successfully' };
  },
};
