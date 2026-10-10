import type { NextFunction, Request, Response } from 'express';
import { isAiEnabled } from '../config/ai';

/**
 * Returns a 503 with a stable machine-readable code when AI is disabled.
 * The factory form lets tests inject the availability check.
 */
export function requireAiEnabled(check: () => boolean = isAiEnabled) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!check()) {
      res.status(503).json({
        success: false,
        error: 'The AI planner is not configured on this server. Use the manual plan wizard instead.',
        code: 'AI_DISABLED',
      });
      return;
    }
    next();
  };
}
