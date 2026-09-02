import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),

  JWT_ADMIN_SECRET: z.string().min(32),
  JWT_CUSTOMER_SECRET: z.string().min(32),
  JWT_ADMIN_AUDIENCE: z.string().default('cutie-baby-admin'),
  JWT_CUSTOMER_AUDIENCE: z.string().default('cutie-baby-customer'),
  JWT_ISSUER: z.string().default('cutie-baby-api'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX_PUBLIC: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_MAX_AUTH: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_MAX_WRITE: z.coerce.number().int().positive().default(60),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(10).optional(),
  ADMIN_NAME: z.string().optional(),

  // Cloudflare R2 — optional until credentials are provided
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
  R2_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(5),

  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().default('Cutie Dreams <noreply@cutiedreams.com>'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

function ttlToMs(ttl: string): number {
  const match = ttl.match(/^(\d+)\s*([smhd])$/i);
  if (!match) return 15 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const map: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (map[unit] ?? 60_000);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
  R2_MAX_FILE_SIZE_BYTES: parsed.data.R2_MAX_FILE_SIZE_MB * 1024 * 1024,
  ACCESS_TOKEN_TTL_MS: ttlToMs(parsed.data.ACCESS_TOKEN_TTL),
};
