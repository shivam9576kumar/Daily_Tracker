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

import { prisma } from '../config/database';

/**
 * GET /api/auth/google
 * Redirects to Google's OAuth consent screen.
 */
export function googleLogin(_req: Request, res: Response) {
  if (!env.GOOGLE_CLIENT_ID) {
    return res.status(400).send(`
      <h2>Google OAuth Client ID not configured on server.</h2>
      <p>Please return to the login page and use <strong>Continue as Guest / Demo</strong>, or configure <code>GOOGLE_CLIENT_ID</code> in Render environment variables.</p>
    `);
  }
  const url = getGoogleAuthUrl();
  res.redirect(url);
}

/**
 * POST /api/auth/demo
 * Creates or retrieves a demo student account and returns a JWT token.
 */
export async function demoLogin(_req: Request, res: Response, next: NextFunction) {
  try {
    let user = await prisma.user.findFirst({
      where: { email: 'demo@dsatracker.com' },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: 'demo-student-id',
          email: 'demo@dsatracker.com',
          name: 'Demo Student',
          coins: 100,
        },
      });
    }

    const token = generateToken({ userId: user.id, email: user.email });
    logger.info(`Demo user logged in: ${user.email}`);

    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        coins: user.coins,
      },
    });
  } catch (error) {
    next(error);
  }
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
    const hostOrigin = `${req.protocol}://${req.get('host')}`;
    const baseUrl = (env.FRONTEND_URL && !env.FRONTEND_URL.includes('localhost'))
      ? env.FRONTEND_URL
      : (env.isProd ? hostOrigin : env.FRONTEND_URL);

    res.redirect(`${baseUrl}/auth/callback?token=${token}`);
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
