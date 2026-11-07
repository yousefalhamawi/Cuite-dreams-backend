import { query } from '../config/database';
import { hashPassword } from '../utils';
import { conflict, notFound } from '../utils/errors';
import { writeAudit } from './audit.service';

export interface DeliveryUser {
  id: string;
  name: string;
  email: string;
  role: 'delivery';
  is_active: boolean;
  created_at: Date;
  last_login: Date | null;
}

export async function listDeliveryUsers(): Promise<DeliveryUser[]> {
  const { rows } = await query<DeliveryUser>(
    `SELECT id, name, email, role, is_active, created_at, last_login
     FROM admin_users WHERE role = 'delivery' ORDER BY created_at DESC`,
  );
  return rows;
}

export async function createDeliveryUser(
  input: { name: string; email: string; password: string },
  actorId: string,
): Promise<DeliveryUser> {
  const passwordHash = await hashPassword(input.password);
  try {
    const { rows } = await query<DeliveryUser>(
      `INSERT INTO admin_users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'delivery')
       RETURNING id, name, email, role, is_active, created_at, last_login`,
      [input.name.trim(), input.email.trim().toLowerCase(), passwordHash],
    );
    const user = rows[0];
    await writeAudit({
      actorType: 'admin', actorId, action: 'delivery_user.create',
      entityType: 'admin_users', entityId: user.id,
      afterData: { email: user.email, role: user.role },
    });
    return user;
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw conflict('Email already belongs to an admin account');
    }
    throw error;
  }
}

export async function updateDeliveryUser(
  id: string,
  input: { is_active?: boolean; password?: string },
  actorId: string,
): Promise<DeliveryUser> {
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const { rows } = await query<DeliveryUser>(
    `UPDATE admin_users
     SET is_active = COALESCE($2, is_active),
         password_hash = COALESCE($3, password_hash),
         failed_logins = 0, locked_until = NULL, updated_at = NOW()
     WHERE id = $1 AND role = 'delivery'
     RETURNING id, name, email, role, is_active, created_at, last_login`,
    [id, input.is_active ?? null, passwordHash],
  );
  const user = rows[0];
  if (!user) throw notFound('Delivery account not found');
  if (input.is_active === false || passwordHash) {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE admin_id = $1 AND revoked_at IS NULL`,
      [id],
    );
  }
  await writeAudit({
    actorType: 'admin', actorId, action: 'delivery_user.update',
    entityType: 'admin_users', entityId: id,
    afterData: { is_active: user.is_active, password_changed: Boolean(passwordHash) },
  });
  return user;
}
