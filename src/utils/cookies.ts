import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';

export const COOKIE = {
  access: 'cd_access',
  refresh: 'cd_refresh',
  session: 'cd_session',
  adminAccess: 'cd_admin_access',
  adminRefresh: 'cd_admin_refresh',
} as const;

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/',
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(COOKIE.access, accessToken, {
    ...baseOptions(),
    maxAge: env.ACCESS_TOKEN_TTL_MS,
  });
  res.cookie(COOKIE.refresh, refreshToken, {
    ...baseOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  const opts = baseOptions();
  res.clearCookie(COOKIE.access, opts);
  res.clearCookie(COOKIE.refresh, opts);
}

export function setAdminCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(COOKIE.adminAccess, accessToken, {
    ...baseOptions(),
    maxAge: env.ACCESS_TOKEN_TTL_MS,
  });
  res.cookie(COOKIE.adminRefresh, refreshToken, {
    ...baseOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAdminCookies(res: Response): void {
  const opts = baseOptions();
  res.clearCookie(COOKIE.adminAccess, opts);
  res.clearCookie(COOKIE.adminRefresh, opts);
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(COOKIE.session, sessionId, {
    ...baseOptions(),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}
