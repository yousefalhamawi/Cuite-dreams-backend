import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/** In-memory store — no Redis. Suitable for a single Node instance. */

function makeLimiter(max: number, message: string) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message } },
    handler: (req, res, _next, options) => {
      const retryAfter = Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      console.warn(`[rate-limit] ${req.ip} ${req.method} ${req.path}`);
      res.status(options.statusCode).json(options.message);
    },
  });
}

export const publicReadLimiter = makeLimiter(
  env.RATE_LIMIT_MAX_PUBLIC,
  'Too many requests',
);

export const authLimiter = makeLimiter(
  env.RATE_LIMIT_MAX_AUTH,
  'Too many authentication attempts',
);

export const writeLimiter = makeLimiter(
  env.RATE_LIMIT_MAX_WRITE,
  'Too many write requests',
);
