import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/tokens';
import { unauthorized } from '../utils/errors';
import { COOKIE } from '../utils/cookies';
import type { AdminRole } from '../types';
import { query } from '../config/database';
import { forbidden } from '../utils/errors';

function extractCustomerToken(req: Request): string | null {
  const fromCookie = req.cookies?.[COOKIE.access];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

function extractAdminToken(req: Request): string | null {
  const fromCookie = req.cookies?.[COOKIE.adminAccess];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export function requireAdmin(...allowedRoles: AdminRole[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    let adminId: string;
    try {
      const token = extractAdminToken(req);
      if (!token) {
        next(unauthorized());
        return;
      }
      const payload = verifyAccessToken('admin', token);
      adminId = payload.sub;
    } catch {
      next(unauthorized('Invalid or expired token'));
      return;
    }

    try {
      const { rows } = await query<{ role: AdminRole }>(
        `SELECT role FROM admin_users WHERE id = $1 AND is_active = TRUE`,
        [adminId],
      );
      const role = rows[0]?.role;
      if (!role) return next(unauthorized());
      if (!(allowedRoles.length ? allowedRoles : ['super_admin']).includes(role)) {
        return next(forbidden('This account cannot access this section'));
      }
      req.admin = { id: adminId, role };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireCustomer(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractCustomerToken(req);
    if (!token) {
      next(unauthorized());
      return;
    }
    const payload = verifyAccessToken('customer', token);
    req.customer = { id: payload.sub };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

/** Optional admin auth — attaches admin if a valid admin cookie is present. */
export async function optionalAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractAdminToken(req);
    if (token) {
      const payload = verifyAccessToken('admin', token);
      const { rows } = await query<{ role: AdminRole }>(
        `SELECT role FROM admin_users WHERE id = $1 AND is_active = TRUE`,
        [payload.sub],
      );
      if (rows[0]?.role === 'super_admin') {
        req.admin = { id: payload.sub, role: 'super_admin' };
      }
    }
  } catch {
    // ignore
  }
  next();
}

/** Guest is allowed. A bad/expired cookie still 401 so the client can refresh. */
export function customerOrGuest(req: Request, _res: Response, next: NextFunction): void {
  const token = extractCustomerToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken('customer', token);
    req.customer = { id: payload.sub };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

export function optionalCustomer(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractCustomerToken(req);
    if (token) {
      const payload = verifyAccessToken('customer', token);
      req.customer = { id: payload.sub };
    }
  } catch {
    // ignore invalid optional token
  }
  next();
}
