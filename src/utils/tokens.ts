import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type TokenAudience = 'admin' | 'customer';

export interface AccessPayload {
  sub: string;
  role: string;
  typ: 'access';
}

export function signAccessToken(
  audience: TokenAudience,
  payload: Omit<AccessPayload, 'typ'>,
): string {
  const secret = audience === 'admin' ? env.JWT_ADMIN_SECRET : env.JWT_CUSTOMER_SECRET;
  const aud = audience === 'admin' ? env.JWT_ADMIN_AUDIENCE : env.JWT_CUSTOMER_AUDIENCE;

  return jwt.sign({ ...payload, typ: 'access' }, secret, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
    issuer: env.JWT_ISSUER,
    audience: aud,
  });
}

export function verifyAccessToken(
  audience: TokenAudience,
  token: string,
): AccessPayload {
  const secret = audience === 'admin' ? env.JWT_ADMIN_SECRET : env.JWT_CUSTOMER_SECRET;
  const aud = audience === 'admin' ? env.JWT_ADMIN_AUDIENCE : env.JWT_CUSTOMER_AUDIENCE;

  return jwt.verify(token, secret, {
    issuer: env.JWT_ISSUER,
    audience: aud,
  }) as AccessPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function refreshExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + env.REFRESH_TOKEN_TTL_DAYS);
  return d;
}
