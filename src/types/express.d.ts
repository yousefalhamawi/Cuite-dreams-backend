import type { Request } from 'express';

export interface AuthAdmin {
  id: string;
  role: import('./index').AdminRole;
}

export interface AuthCustomer {
  id: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AuthAdmin;
      customer?: AuthCustomer;
      requestId?: string;
      sessionId?: string;
    }
  }
}

export type AuthedAdminRequest = Request & { admin: AuthAdmin };
export type AuthedCustomerRequest = Request & { customer: AuthCustomer };

/** PII sensitivity map — document once, enforce in services */
export const PII_FIELDS = {
  customers: {
    name: 'medium',
    phone: 'high',
    email: 'high',
    address: 'high',
    city: 'low',
    country: 'low',
  },
  admin_users: {
    name: 'medium',
    email: 'high',
    password_hash: 'high',
  },
} as const;

export {};
