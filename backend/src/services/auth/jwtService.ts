import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * Generate a JWT token for authenticated users.
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
}

/**
 * Verify and decode a JWT token.
 * Returns the decoded payload or null if invalid.
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
