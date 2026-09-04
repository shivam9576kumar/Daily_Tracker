import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { getAuthUser } from '../middleware/authMiddleware';
import { getTz } from '../middleware/timezoneMiddleware';
import { todayKey } from '../utils/dateKeys';
import {
  loadQuestionBank,
  getAvailableTopics,
  getTopicCount,
} from '../services/plan/questionBankLoader';
import { geminiPlanChat } from '../services/ai/geminiPlanChat';
import { planGenerationService } from '../services/plan/planGenerationService';
import { planService } from '../services/plan/planService';
import { geminiPlanParser } from '../services/ai/geminiPlanParser';
import { sendSuccess } from '../utils/response';
import { ValidationError } from '../utils/error';

function buildPlannerContext(
  timezone: string,
  hasActivePlan: boolean
) {
  const makeSource = (
    id: 'neetcode150' | 'coderarmy',
    name: string
  ) => {
    const questions = loadQuestionBank(id);

    return {
      id,
      name,
      total: questions.length,
      topics: getAvailableTopics(questions).map((topic) => ({
        name: topic,
        available: getTopicCount(questions, topic),
      })),
    };
  };

  return {
    today: todayKey(timezone),
    timezone,
    hasActivePlan,
    sources: [
      makeSource('neetcode150', 'NeetCode 150'),
      makeSource('coderarmy', 'Coder Army Sheet'),
    ],
  };
}

export const planController = {
  async aiConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const { messages, draft } = req.body;

      if (!Array.isArray(messages)) {
        throw new ValidationError('messages must be an array');
      }

      if (!draft || typeof draft !== 'object') {
        throw new ValidationError('draft is required');
      }

      const timezone = getTz(req);

      const activePlan = await prisma.plan.findFirst({
        where: {
          userId: user.id,
          status: 'active',
        },
        select: {
          id: true,
        },
      });

      const context = buildPlannerContext(
        timezone,
        Boolean(activePlan)
      );

      const result = await geminiPlanChat.process({
        messages,
        draft,
        context,
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async aiParse(req: Request, res: Response, next: NextFunction) {
    try {
      const { prompt } = req.body;
      const parsed = await geminiPlanParser.parsePrompt(prompt || '');
      sendSuccess(res, parsed);
    } catch (err) {
      next(err);
    }
  },

  async preview(req: Request, res: Response, next: NextFunction) {
    try {
      let userId: string | undefined;
      try {
        const user = getAuthUser(req);
        userId = user?.id;
      } catch {
        // Optional auth
      }
      const preview = await planGenerationService.previewPlan(req.body);
      sendSuccess(res, preview);
    } catch (err) {
      next(err);
    }
  },

  async commit(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const result = await planGenerationService.commitPlan(user.id, req.body);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/plans/active → { plan, tasks, revisions, origin } (plan may be null) */
  async getActive(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await planService.getActivePlan(user.id));
    } catch (err) { next(err); }
  },

  async getArchived(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await planService.getArchivedPlans(user.id));
    } catch (err) { next(err); }
  },

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      const plan = await planService.restorePlan(user.id, id);
      sendSuccess(res, plan);
    } catch (err) { next(err); }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      const result = await planService.deletePlan(user.id, id);
      sendSuccess(res, { message: 'Plan deleted', ...result });
    } catch (err) { next(err); }
  },

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const planId = req.params.id as string;
      const result = await planGenerationService.archivePlan(user.id, planId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
};
