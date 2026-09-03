import { Request, Response, NextFunction } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { planGenerationService } from '../services/plan/planGenerationService';
import { planService } from '../services/plan/planService';
import { geminiPlanParser } from '../services/ai/geminiPlanParser';
import { sendSuccess } from '../utils/response';

export const planController = {
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
