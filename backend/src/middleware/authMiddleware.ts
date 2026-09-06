import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth/jwtService';
import { UnauthorizedError } from '../utils/error';
import prisma from '../config/database';

type CachedUser = { id: string; email: string; name: string; avatarUrl: string | null; coins: number; timezone: string | null; exp: number };
const userCache = new Map<string, CachedUser>(); // key = userId
const CACHE_TTL_MS = 60_000; // 1 minute

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError('Missing or invalid authorization header');

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (!decoded?.userId) throw new UnauthorizedError('Invalid or expired token');

    const now = Date.now();
    const cached = userCache.get(decoded.userId);
    if (cached && cached.exp > now) {
      (req as any).user = cached;
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, avatarUrl: true, coins: true, timezone: true },
    });
    if (!user) throw new UnauthorizedError('User not found');

    const reqTz = (req as any).tz as string | undefined;
    const entry: CachedUser = { ...user, coins: user.coins ?? 0, timezone: user.timezone ?? null, exp: now + CACHE_TTL_MS };

    // BUG 8: persist last-seen tz for crons (fire-and-forget, never blocks request)
    if (reqTz && user.timezone !== reqTz) {
      entry.timezone = reqTz;
      prisma.user.update({ where: { id: user.id }, data: { timezone: reqTz } }).catch(() => {});
    }

    userCache.set(user.id, entry);
    (req as any).user = entry;
    next();
  } catch (error) {
    next(error);
  }
}

export function getAuthUser(req: Request) {
  const user = (req as any).user;
  if (!user) throw new UnauthorizedError('Not authenticated');
  return user as { id: string; email: string; name: string; avatarUrl: string | null; coins: number; timezone: string | null };
}

/** Call after coin changes if anything reads User.coins from cache in the same process. */
export function invalidateUserCache(userId: string) {
  userCache.delete(userId);
}
