import { Request, Response, NextFunction } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { getTz } from '../middleware/timezoneMiddleware';
import { ensurePotdTaskForUser, dismissPotdForUser, currentPotdDateKey } from '../services/potd/potdService';
import { computePotdStreak } from '../services/potd/potdStreakService';
import { sendSuccess } from '../utils/response';
import { ValidationError } from '../utils/error';

export const potdController = {
  async today(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const result = await ensurePotdTaskForUser(user.id, getTz(req));
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  async dismiss(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const dateKey = String(req.body?.dateKey ?? currentPotdDateKey());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new ValidationError('dateKey must be YYYY-MM-DD');
      await dismissPotdForUser(user.id, dateKey);
      sendSuccess(res, { ok: true, dateKey });
    } catch (err) { next(err); }
  },

  async streak(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await computePotdStreak(user.id, getTz(req)));
    } catch (err) { next(err); }
  },
};
