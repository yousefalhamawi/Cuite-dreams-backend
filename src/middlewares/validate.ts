import type { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { badRequest } from '../utils/errors';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      next(badRequest('Validation failed', parsed.error.flatten()));
      return;
    }
    // Express 5: req.query (and sometimes req.params) are getter-only.
    if (source === 'body') {
      req.body = parsed.data;
    }
    next();
  };
}
