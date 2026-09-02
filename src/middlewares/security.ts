import helmet from 'helmet';
import cors from 'cors';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { randomUUID } from 'crypto';

export const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin) || !env.isProd) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
});

export const requestId: RequestHandler = (req, _res, next) => {
  req.requestId = (req.headers['x-request-id'] as string) || randomUUID();
  next();
};
