import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import logger from '../utils/logger';

export function errorMiddleware(err: any, req: Request, res: Response, _next: NextFunction) {
  let status: number = err?.statusCode ?? 500;
  let message: string = err?.message ?? 'Internal server error';
  const code: string | undefined = err?.code;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': status = 409; message = 'Duplicate record'; break;
      case 'P2003': status = 400; message = 'Related record does not exist'; break;
      case 'P2025': status = 404; message = 'Record not found'; break;
      case 'P2021':
      case 'P2022': status = 500; message = `Database schema mismatch (${err.code}) — see server log`; break;
      case 'P2024':
      case 'P2028': status = 503; message = 'Database is slow right now — please retry'; break;
      default:     status = 500; message = `Database error (${err.code})`;
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    status = 500; message = 'Invalid database query — see server log';
  } else if (status >= 500) {
    message = 'Internal server error';
  }

  const log = { method: req.method, url: req.originalUrl, status, code, meta: err?.meta, error: err?.message, stack: err?.stack };
  if (status >= 500) logger.error('Unhandled request error', log); else logger.warn('Request error', log);

  res.status(status).json({
    success: false,
    error: message,
    ...(env.isDev ? { code, details: err?.message } : {}),
  });
}
