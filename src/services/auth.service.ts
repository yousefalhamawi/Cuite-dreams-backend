import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { query } from '../config/database';
import {
  generateRefreshToken,
  hashToken,
  refreshExpiresAt,
  signAccessToken,
} from '../utils/tokens';
import { unauthorized, tooManyRequests, conflict } from '../utils/errors';
import { verifyPassword, hashPassword } from '../utils';
import { writeAudit } from './audit.service';
import type { AdminRole } from '../types';

const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

interface AdminRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  is_active: boolean;
  failed_logins: number;
  locked_until: Date | null;
}

export async function adminLogin(
  email: string,
  password: string,
  meta: { ip?: string; userAgent?: string },
): Promise<{ accessToken: string; refreshToken: string; admin: { id: string; name: string; email: string; role: AdminRole } }> {
  const { rows } = await query<AdminRow>(
    `SELECT id, name, email, password_hash, role, is_active, failed_logins, locked_until
     FROM admin_users WHERE email = $1`,
    [email.toLowerCase()],
  );
  const admin = rows[0];

  if (!admin || !admin.is_active) {
    throw unauthorized('Invalid credentials');
  }

  if (admin.locked_until && admin.locked_until > new Date()) {
    throw tooManyRequests('Account temporarily locked', LOCK_MINUTES * 60);
  }

  const ok = await verifyPassword(password, admin.password_hash);
  if (!ok) {
    const fails = admin.failed_logins + 1;
    const lock =
      fails >= LOCK_THRESHOLD
        ? new Date(Date.now() + LOCK_MINUTES * 60_000)
        : null;
    await query(
      `UPDATE admin_users SET failed_logins = $1, locked_until = $2, updated_at = NOW() WHERE id = $3`,
      [fails, lock, admin.id],
    );
    throw unauthorized('Invalid credentials');
  }

  await query(
    `UPDATE admin_users
     SET failed_logins = 0, locked_until = NULL, last_login = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [admin.id],
  );

  const tokens = await issueAdminTokens(admin.id, admin.role);

  await writeAudit({
    actorType: 'admin',
    actorId: admin.id,
    action: 'admin.login',
    entityType: 'admin_users',
    entityId: admin.id,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    ...tokens,
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
  };
}

async function issueAdminTokens(adminId: string, role: AdminRole) {
  const accessToken = signAccessToken('admin', { sub: adminId, role });
  const refreshToken = generateRefreshToken();
  const familyId = randomUUID();

  await query(
    `INSERT INTO refresh_tokens (admin_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [adminId, hashToken(refreshToken), familyId, refreshExpiresAt()],
  );

  return { accessToken, refreshToken };
}

export async function rotateAdminRefresh(
  rawRefresh: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenHash = hashToken(rawRefresh);
  const { rows } = await query<{
    id: string;
    admin_id: string;
    family_id: string;
    expires_at: Date;
    revoked_at: Date | null;
    role: AdminRole;
  }>(
    `SELECT rt.id, rt.admin_id, rt.family_id, rt.expires_at, rt.revoked_at, a.role
     FROM refresh_tokens rt
     JOIN admin_users a ON a.id = rt.admin_id
     WHERE rt.token_hash = $1 AND a.is_active = TRUE`,
    [tokenHash],
  );

  const row = rows[0];
  if (!row) throw unauthorized('Invalid refresh token');

  if (row.revoked_at) {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL`,
      [row.family_id],
    );
    throw unauthorized('Refresh token reuse detected');
  }

  if (row.expires_at < new Date()) {
    throw unauthorized('Refresh token expired');
  }

  await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id]);

  const accessToken = signAccessToken('admin', { sub: row.admin_id, role: row.role });
  const newRefresh = generateRefreshToken();

  await query(
    `INSERT INTO refresh_tokens (admin_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [row.admin_id, hashToken(newRefresh), row.family_id, refreshExpiresAt()],
  );

  return { accessToken, refreshToken: newRefresh };
}

export async function getAdminById(id: string) {
  const { rows } = await query<{
    id: string;
    name: string;
    email: string;
    role: AdminRole;
  }>(
    `SELECT id, name, email, role FROM admin_users WHERE id = $1 AND is_active = TRUE`,
    [id],
  );
  if (!rows[0]) throw unauthorized();
  return rows[0];
}

export async function revokeAdminRefresh(rawRefresh: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(rawRefresh)],
  );
}

export async function customerRegister(input: {
  name: string;
  phone: string;
  email: string;
  password: string;
  address?: string;
  city?: string;
  country?: string;
}) {
  const email = input.email.toLowerCase();
  const existingEmail = await query<{ id: string }>(
    `SELECT id FROM customers WHERE email = $1`,
    [email],
  );
  if (existingEmail.rows[0]) throw conflict('Email already registered');

  const passwordHash = await hashPassword(input.password);

  const { rows } = await query(
    `INSERT INTO customers (name, phone, email, password_hash, address, city, country)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (phone) DO NOTHING
     RETURNING id, name, phone, email, address, city, country, created_at`,
    [
      input.name,
      input.phone,
      email,
      passwordHash,
      input.address ?? null,
      input.city ?? null,
      input.country ?? 'SY',
    ],
  );

  if (!rows[0]) {
    throw conflict('Phone already registered');
  }

  const customer = rows[0] as {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  };

  const tokens = await issueCustomerTokens(customer.id);
  return { ...tokens, customer };
}

export async function customerLogin(email: string, password: string) {
  const { rows } = await query<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    password_hash: string | null;
    is_active: boolean;
  }>(
    `SELECT id, name, phone, email, password_hash, is_active FROM customers WHERE email = $1`,
    [email.toLowerCase()],
  );
  const customer = rows[0];
  if (!customer?.is_active || !customer.password_hash) {
    throw unauthorized('Invalid credentials');
  }
  const ok = await verifyPassword(password, customer.password_hash);
  if (!ok) throw unauthorized('Invalid credentials');

  const tokens = await issueCustomerTokens(customer.id);
  return {
    ...tokens,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    },
  };
}

async function issueCustomerTokens(customerId: string) {
  const accessToken = signAccessToken('customer', { sub: customerId, role: 'customer' });
  const refreshToken = generateRefreshToken();
  await query(
    `INSERT INTO refresh_tokens (customer_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [customerId, hashToken(refreshToken), randomUUID(), refreshExpiresAt()],
  );
  return { accessToken, refreshToken };
}

export async function rotateCustomerRefresh(
  rawRefresh: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenHash = hashToken(rawRefresh);
  const { rows } = await query<{
    id: string;
    customer_id: string;
    family_id: string;
    expires_at: Date;
    revoked_at: Date | null;
  }>(
    `SELECT id, customer_id, family_id, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = $1 AND customer_id IS NOT NULL`,
    [tokenHash],
  );

  const row = rows[0];
  if (!row) throw unauthorized('Invalid refresh token');

  if (row.revoked_at) {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL`,
      [row.family_id],
    );
    throw unauthorized('Refresh token reuse detected');
  }

  if (row.expires_at < new Date()) {
    throw unauthorized('Refresh token expired');
  }

  await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id]);

  const accessToken = signAccessToken('customer', { sub: row.customer_id, role: 'customer' });
  const newRefresh = generateRefreshToken();

  await query(
    `INSERT INTO refresh_tokens (customer_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [row.customer_id, hashToken(newRefresh), row.family_id, refreshExpiresAt()],
  );

  return { accessToken, refreshToken: newRefresh };
}

export async function revokeCustomerRefresh(rawRefresh: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND customer_id IS NOT NULL AND revoked_at IS NULL`,
    [hashToken(rawRefresh)],
  );
}

export async function getCustomerById(id: string) {
  const { rows } = await query<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
    city: string | null;
    country: string;
    shipping_zone_id: string | null;
  }>(
    `SELECT id, name, phone, email, address, city, country, shipping_zone_id
     FROM customers WHERE id = $1 AND is_active = TRUE`,
    [id],
  );
  if (!rows[0]) throw unauthorized();
  return rows[0];
}

export async function updateCustomerProfile(
  id: string,
  patch: {
    name?: string;
    phone?: string;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    shipping_zone_id?: string | null;
  },
) {
  const allowed = [
    'name',
    'phone',
    'email',
    'address',
    'city',
    'shipping_zone_id',
  ] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      let value = patch[key];
      if (key === 'email' && typeof value === 'string') value = value.toLowerCase();
      sets.push(`${key} = $${i++}`);
      vals.push(value);
    }
  }
  if (sets.length === 0) return getCustomerById(id);

  vals.push(id);
  try {
    const { rows } = await query(
      `UPDATE customers SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${i} AND is_active = TRUE
       RETURNING id, name, phone, email, address, city, country, shipping_zone_id`,
      vals,
    );
    if (!rows[0]) throw unauthorized();
    return rows[0];
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw conflict('Phone or email already in use');
    }
    throw err;
  }
}

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

export async function requestPasswordReset(email: string, locale: 'ar' | 'en' = 'ar'): Promise<void> {
  const normalized = email.toLowerCase();
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM customers WHERE email = $1 AND is_active = TRUE`,
    [normalized],
  );

  // Always look successful — do not leak whether the email exists.
  if (!rows[0]) return;

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await query(
    `UPDATE password_reset_otps SET used_at = NOW()
     WHERE email = $1 AND used_at IS NULL`,
    [normalized],
  );
  await query(
    `INSERT INTO password_reset_otps (email, code_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [normalized, hashToken(code), new Date(Date.now() + OTP_TTL_MS)],
  );

  const { sendOtpEmail } = await import('../utils/mail');
  await sendOtpEmail(normalized, code, locale);
}

export async function verifyPasswordOtp(email: string, code: string): Promise<void> {
  await loadValidOtp(email, code, { markVerified: true });
}

export async function resetPasswordWithOtp(
  email: string,
  code: string,
  password: string,
) {
  const row = await loadValidOtp(email, code, { markVerified: false, requireVerified: true });
  const passwordHash = await hashPassword(password);
  const normalized = email.toLowerCase();

  const { rows } = await query<{ id: string }>(
    `UPDATE customers SET password_hash = $1, updated_at = NOW()
     WHERE email = $2 AND is_active = TRUE
     RETURNING id`,
    [passwordHash, normalized],
  );
  if (!rows[0]) throw unauthorized('Invalid credentials');

  await query(`UPDATE password_reset_otps SET used_at = NOW() WHERE id = $1`, [row.id]);
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE customer_id = $1 AND revoked_at IS NULL`,
    [rows[0].id],
  );

  const tokens = await issueCustomerTokens(rows[0].id);
  const customer = await getCustomerById(rows[0].id);
  return { ...tokens, customer };
}

async function loadValidOtp(
  email: string,
  code: string,
  opts: { markVerified: boolean; requireVerified?: boolean },
) {
  const normalized = email.toLowerCase();
  const { rows } = await query<{
    id: string;
    code_hash: string;
    expires_at: Date;
    attempts: number;
    verified_at: Date | null;
    used_at: Date | null;
  }>(
    `SELECT id, code_hash, expires_at, attempts, verified_at, used_at
     FROM password_reset_otps
     WHERE email = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalized],
  );
  const row = rows[0];
  if (!row || row.expires_at < new Date()) {
    throw unauthorized('Invalid or expired code');
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    throw tooManyRequests('Too many attempts', 600);
  }
  if (opts.requireVerified && !row.verified_at) {
    throw unauthorized('Code not verified');
  }
  if (row.code_hash !== hashToken(code)) {
    await query(`UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    throw unauthorized('Invalid or expired code');
  }
  if (opts.markVerified) {
    await query(`UPDATE password_reset_otps SET verified_at = NOW() WHERE id = $1`, [row.id]);
  }
  return row;
}

export async function findOrCreateGuestCustomer(
  client: PoolClient,
  input: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    city: string;
    country: string;
  },
): Promise<string> {
  const existing = await client.query<{ id: string; password_hash: string | null }>(
    `SELECT id, password_hash FROM customers WHERE phone = $1`,
    [input.phone],
  );

  if (existing.rows[0]) {
    // Never overwrite a verified/password account from guest checkout
    if (!existing.rows[0].password_hash) {
      await client.query(
        `UPDATE customers
         SET name = $1, email = COALESCE($2, email), address = $3, city = $4, country = $5, updated_at = NOW()
         WHERE id = $6`,
        [
          input.name,
          input.email?.toLowerCase() ?? null,
          input.address,
          input.city,
          input.country,
          existing.rows[0].id,
        ],
      );
    }
    return existing.rows[0].id;
  }

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO customers (name, phone, email, address, city, country)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.name,
      input.phone,
      input.email?.toLowerCase() ?? null,
      input.address,
      input.city,
      input.country,
    ],
  );
  return inserted.rows[0].id;
}
