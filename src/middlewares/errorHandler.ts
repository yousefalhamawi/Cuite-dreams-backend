import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { sendFail } from '../utils/response';
import { env } from '../config/env';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.statusCode === 429 && err.details && typeof err.details === 'object') {
      const retry = (err.details as { retryAfter?: number }).retryAfter;
      if (retry) res.setHeader('Retry-After', String(retry));
    }
    sendFail(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    sendFail(res, 400, 'VALIDATION_ERROR', 'Validation failed', err.flatten());
    return;
  }

  console.error(err);
  const message = env.isProd ? 'Internal server error' : String(err);
  sendFail(res, 500, 'INTERNAL_ERROR', message);
}

export function notFoundHandler(_req: Request, res: Response): void {
  sendFail(res, 404, 'NOT_FOUND', 'Route not found');
}
