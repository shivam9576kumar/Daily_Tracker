import type { NextFunction, Request, Response } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { getTz } from '../middleware/timezoneMiddleware';
import { sendSuccess } from '../utils/response';
import { dailyChallengeSettingsService } from '../services/dailyChallenges/dailyChallengeSettingsService';
import { cp31Service } from '../services/cp31/cp31Service';

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

  /** POST /api/daily-challenges/cp31/one-more */
  async oneMore(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const result = await cp31Service.serveOneMore(user.id, getTz(req));
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/daily-challenges/cp31/skip/:taskId */
  async skip(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const task = await cp31Service.skipCp31Problem(user.id, req.params.taskId as string);
      sendSuccess(res, task);
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/daily-challenges/cp31/advance-band */
  async advanceBand(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const cp31Band = await cp31Service.advanceCp31Band(user.id);
      sendSuccess(res, { cp31Band });
    } catch (err) {
      next(err);
    }
  },
};
