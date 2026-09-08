import type { NextFunction, Request, Response } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { getTz } from '../middleware/timezoneMiddleware';
import { sendSuccess } from '../utils/response';
import { dailyChallengeSettingsService } from '../services/dailyChallenges/dailyChallengeSettingsService';
import { cp31Service } from '../services/cp31/cp31Service';
import { computeCp31Streak } from '../services/cp31/cp31StreakService';

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
      sendSuccess(res, { task: result.task, state: result.state }, 200);
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/daily-challenges/cp31/skip/:taskId */
  async skip(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const result = await cp31Service.skipCp31Problem(user.id, req.params.taskId as string, getTz(req));
      sendSuccess(res, { skipped: result.skipped ?? result, served: result.served ?? [], state: result.state });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/daily-challenges/cp31/retry/:taskId */
  async retry(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const result = await cp31Service.retrySkippedCp31(user.id, req.params.taskId as string, getTz(req));
      sendSuccess(res, { task: result.task ?? result, state: result.state });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/daily-challenges/cp31/skipped */
  async getSkipped(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const tasks = await cp31Service.listSkippedCp31(user.id);
      sendSuccess(res, tasks);
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/daily-challenges/cp31/advance-band */
  async advanceBand(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const result = await cp31Service.advanceCp31Band(user.id, getTz(req));
      sendSuccess(res, { band: result.band, served: result.served, state: result.state });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/daily-challenges/cp31/streak */
  async getStreak(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const streak = await computeCp31Streak(user.id, getTz(req));
      sendSuccess(res, streak);
    } catch (err) {
      next(err);
    }
  },
};
