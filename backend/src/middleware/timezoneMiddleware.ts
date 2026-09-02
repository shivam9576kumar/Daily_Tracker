import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { isValidTimeZone } from '../utils/dateKeys';

/**
 * Reads the X-Timezone header (IANA zone sent by the frontend) and attaches req.tz.
 * Falls back to DEFAULT_TIMEZONE if missing or invalid.
 */
export function timezoneMiddleware(req: Request, _res: Response, next: NextFunction) {
  const raw = req.headers['x-timezone'];
  const tz = typeof raw === 'string' ? raw.trim() : '';
  (req as any).tz = isValidTimeZone(tz) ? tz : env.DEFAULT_TIMEZONE;
  next();
}

export function getTz(req: Request): string {
  return (req as any).tz || env.DEFAULT_TIMEZONE;
}
