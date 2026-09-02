import { Response } from 'express';

/**
 * Standardized API response helpers.
 * All API responses follow the shape: { success, data?, message?, error? }
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendCreated<T>(res: Response, data: T) {
  return sendSuccess(res, data, 201);
}

export function sendMessage(res: Response, message: string, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  error?: unknown
) {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && error
      ? { details: String(error) }
      : {}),
  });
}
