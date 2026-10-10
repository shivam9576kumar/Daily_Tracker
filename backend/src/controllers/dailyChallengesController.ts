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
      // getTz(req) threads the user's timezone so the service can immediately
      // materialize today's CP31 rung after a band-enable/switch, without
      // requiring a follow-up Todo or Dashboard page load.
      sendSuccess(res, await dailyChallengeSettingsService.update(user.id, req.body ?? {}, getTz(req)));
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/daily-challenges/cp31/one-more */
  async oneMore(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const { task, state } = await cp31Service.serveOneMore(user.id, getTz(req));
      // state is already Cp31PublicState — no internal fields leak through.
      sendSuccess(res, { task, state });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/daily-challenges/cp31/skip/:taskId */
  async skip(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const { skipped, served, state } = await cp31Service.skipCp31Problem(
        user.id,
        req.params.taskId as string,
        getTz(req),
      );
      // Return shape is now unambiguous — no defensive result.skipped ?? result needed.
      sendSuccess(res, { skipped, served, state });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/daily-challenges/cp31/retry/:taskId */
  async retry(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const { task, state } = await cp31Service.retrySkippedCp31(
        user.id,
        req.params.taskId as string,
        getTz(req),
      );
      // Return shape is now unambiguous — no defensive result.task ?? result needed.
      sendSuccess(res, { task, state });
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
      // advanceCp31Band now has a single consistent return shape.
      // tz is required; optional targetBand goes via options object.
      const { band, served, state } = await cp31Service.advanceCp31Band(user.id, getTz(req));
      sendSuccess(res, { band, served, state });
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
