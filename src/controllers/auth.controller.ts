import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { mergeSessionCartIntoCustomer } from '../services/cart.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../utils/helpers';
import {
  COOKIE,
  setAuthCookies,
  clearAuthCookies,
  setAdminCookies,
  clearAdminCookies,
} from '../utils/cookies';
import { unauthorized } from '../utils/errors';

function readCustomerRefresh(req: Request): string {
  const fromCookie = req.cookies?.[COOKIE.refresh];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  if (typeof req.body?.refreshToken === 'string') return req.body.refreshToken;
  throw unauthorized('Refresh token missing');
}

function readAdminRefresh(req: Request): string {
  const fromCookie = req.cookies?.[COOKIE.adminRefresh];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  if (typeof req.body?.refreshToken === 'string') return req.body.refreshToken;
  throw unauthorized('Refresh token missing');
}

async function attachSessionCart(req: Request, customerId: string): Promise<void> {
  const sessionId = req.cookies?.[COOKIE.session] as string | undefined;
  if (sessionId) await mergeSessionCartIntoCustomer(sessionId, customerId);
}

export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.adminLogin(req.body.email, req.body.password, {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });
  setAdminCookies(res, result.accessToken, result.refreshToken);
  sendSuccess(res, { admin: result.admin });
});

export const adminRefresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.rotateAdminRefresh(readAdminRefresh(req));
  setAdminCookies(res, result.accessToken, result.refreshToken);
  sendSuccess(res, { ok: true });
});

export const adminLogout = asyncHandler(async (req: Request, res: Response) => {
  try {
    await authService.revokeAdminRefresh(readAdminRefresh(req));
  } catch {
    // already logged out
  }
  clearAdminCookies(res);
  sendSuccess(res, { ok: true });
});

export const adminMe = asyncHandler(async (req: Request, res: Response) => {
  const admin = await authService.getAdminById(req.admin!.id);
  sendSuccess(res, { admin });
});

export const customerRegister = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.customerRegister(req.body);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  await attachSessionCart(req, result.customer.id);
  sendCreated(res, { customer: result.customer });
});

export const customerLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.customerLogin(req.body.email, req.body.password);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  await attachSessionCart(req, result.customer.id);
  sendSuccess(res, { customer: result.customer });
});

export const customerRefresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.rotateCustomerRefresh(readCustomerRefresh(req));
  setAuthCookies(res, result.accessToken, result.refreshToken);
  sendSuccess(res, { ok: true });
});

export const customerLogout = asyncHandler(async (req: Request, res: Response) => {
  try {
    await authService.revokeCustomerRefresh(readCustomerRefresh(req));
  } catch {
    // already logged out
  }
  clearAuthCookies(res);
  sendSuccess(res, { ok: true });
});

export const customerMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.customer?.id) {
    sendSuccess(res, { customer: null });
    return;
  }
  const customer = await authService.getCustomerById(req.customer.id);
  sendSuccess(res, { customer });
});

export const customerPatch = asyncHandler(async (req: Request, res: Response) => {
  const customer = await authService.updateCustomerProfile(req.customer!.id, req.body);
  sendSuccess(res, { customer });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const locale = req.get('accept-language')?.toLowerCase().startsWith('en') ? 'en' : 'ar';
  await authService.requestPasswordReset(req.body.email, locale);
  sendSuccess(res, { ok: true });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  await authService.verifyPasswordOtp(req.body.email, req.body.code);
  sendSuccess(res, { ok: true });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.resetPasswordWithOtp(
    req.body.email,
    req.body.code,
    req.body.password,
  );
  setAuthCookies(res, result.accessToken, result.refreshToken);
  sendSuccess(res, { customer: result.customer });
});
