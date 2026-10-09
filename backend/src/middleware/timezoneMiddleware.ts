import { Request, Response, NextFunction } from 'express';
import { isValidTimeZone, resolveTimeZone } from '../utils/dateKeys';

/**
 * Reads the X-Timezone header (IANA zone sent by the frontend) and attaches req.explicitTz / req.tz.
 * Falls back to validated DEFAULT_TIMEZONE if missing or invalid.
 */
export function timezoneMiddleware(req: Request, _res: Response, next: NextFunction) {
  const raw = req.headers['x-timezone'];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  const explicitTz = isValidTimeZone(trimmed) ? trimmed : undefined;

  (req as any).explicitTz = explicitTz;
  const initialResolved = explicitTz || resolveTimeZone();
  (req as any).tz = initialResolved;
  (req as any).timezone = initialResolved;
  next();
}

export function getTz(req: Request): string {
  return (req as any).tz || (req as any).timezone || resolveTimeZone();
}
