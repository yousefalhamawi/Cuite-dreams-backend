import { query } from '../config/database';

interface AuditInput {
  actorType: 'admin' | 'customer' | 'system';
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  await query(
    `INSERT INTO audit_logs
      (actor_type, actor_id, action, entity_type, entity_id, before_data, after_data, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.actorType,
      input.actorId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.beforeData ? JSON.stringify(input.beforeData) : null,
      input.afterData ? JSON.stringify(input.afterData) : null,
      input.ipAddress ?? null,
      input.userAgent ?? null,
    ],
  );
}
