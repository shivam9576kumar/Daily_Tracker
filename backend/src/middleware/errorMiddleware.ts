import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error';
import { sendError } from '../utils/response';
import logger from '../utils/logger';

/**
 * Global error handling middleware.
 * Catches AppError instances for clean responses; logs unexpected errors.
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational error:', err);
    }
    return sendError(res, err.message, err.statusCode);
  }

  // Unexpected error
  logger.error('Unhandled error:', err);
  return sendError(
    res,
    'Internal server error',
    500,
    process.env.NODE_ENV === 'development' ? err.message : undefined
  );
}
