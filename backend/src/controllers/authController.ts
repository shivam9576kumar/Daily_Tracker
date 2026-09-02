import { Request, Response, NextFunction } from 'express';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
} from '../services/auth/googleAuthService';
import { generateToken } from '../services/auth/jwtService';
import { getAuthUser } from '../middleware/authMiddleware';
import { sendSuccess, sendError } from '../utils/response';
import { env } from '../config/env';
import logger from '../utils/logger';

/**
 * GET /api/auth/google
 * Redirects to Google's OAuth consent screen.
 */
export function googleLogin(_req: Request, res: Response) {
  const url = getGoogleAuthUrl();
  res.redirect(url);
}

/**
 * GET /api/auth/google/callback
 * Handles the OAuth callback, exchanges code, creates user, returns JWT.
 */
export async function googleCallback(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return sendError(res, 'Missing authorization code', 400);
    }

    const user = await handleGoogleCallback(code);
    const token = generateToken({ userId: user.id, email: user.email });

    logger.info(`User logged in: ${user.email}`);

    // Redirect to frontend with token
    res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(req);
    sendSuccess(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      coins: user.coins,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout
 * Client-side logout — just acknowledges the request.
 * Token invalidation happens on the client by removing the stored token.
 */
export function logout(_req: Request, res: Response) {
  sendSuccess(res, { message: 'Logged out successfully' });
}
