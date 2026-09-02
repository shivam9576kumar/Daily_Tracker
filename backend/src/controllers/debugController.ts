import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ForbiddenError } from '../utils/error';
import { sendSuccess } from '../utils/response';
import { getAuthUser } from '../middleware/authMiddleware';
import { revisionConsistency } from '../utils/revisionConsistency';
import { runBacklogCron } from '../cron/backlogCron';
import { runExpiryCron } from '../cron/expiryCron';

function ensureDevOnly() {
  if (!env.isDev) {
    throw new ForbiddenError('Debug routes are only available in development');
  }
}

export const debugController = {
  async revisionReport(req: Request, res: Response, next: NextFunction) {
    try {
      ensureDevOnly();

      const user = getAuthUser(req);
      const report = await revisionConsistency.getReport(user.id);

      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  },

  async runBacklog(req: Request, res: Response, next: NextFunction) {
    try {
      ensureDevOnly();

      const result = await runBacklogCron();

      sendSuccess(res, {
        message: 'Backlog cron executed manually',
        result,
      });
    } catch (err) {
      next(err);
    }
  },

  async runExpiry(req: Request, res: Response, next: NextFunction) {
    try {
      ensureDevOnly();

      const result = await runExpiryCron();

      sendSuccess(res, {
        message: 'Expiry cron executed manually',
        result,
      });
    } catch (err) {
      next(err);
    }
  },
};
