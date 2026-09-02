import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth/jwtService';
import { UnauthorizedError } from '../utils/error';
import prisma from '../config/database';

/**
 * Express middleware that verifies JWT from Authorization header.
 * Attaches `req.user` on success.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    // Fetch user from database to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Attach user to request object
    (req as any).user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to get the authenticated user from the request.
 * Use inside route handlers that are protected by authMiddleware.
 */
export function getAuthUser(req: Request) {
  const user = (req as any).user;
  if (!user) {
    throw new UnauthorizedError('Not authenticated');
  }
  return user as {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    coins: number;
  };
}
