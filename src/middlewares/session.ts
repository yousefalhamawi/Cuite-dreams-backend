import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { COOKIE, setSessionCookie } from '../utils/cookies';

/** Guest cart identity. Logged-in customers skip this. */
export function guestSession(req: Request, res: Response, next: NextFunction): void {
  if (req.customer?.id) {
    next();
    return;
  }

  let sessionId = req.cookies?.[COOKIE.session] as string | undefined;
  if (!sessionId || sessionId.length < 8) {
    sessionId = randomUUID();
    setSessionCookie(res, sessionId);
  }
  req.sessionId = sessionId;
  next();
}
