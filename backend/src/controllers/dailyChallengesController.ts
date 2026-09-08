import type { NextFunction, Request, Response } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { sendSuccess } from '../utils/response';
import { dailyChallengeSettingsService } from '../services/dailyChallenges/dailyChallengeSettingsService';

export const dailyChallengesController = {
  /** GET /api/daily-challenges/settings */
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await dailyChallengeSettingsService.get(user.id));
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/daily-challenges/settings */
  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await dailyChallengeSettingsService.update(user.id, req.body ?? {}));
    } catch (err) {
      next(err);
    }
  },
};
