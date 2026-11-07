import { query, withTransaction } from '../config/database';
import { writeAudit } from './audit.service';

export async function getExchangeRate() {
  const { rows } = await query(
    `SELECT syp_per_usd, note, updated_at FROM exchange_rate_settings WHERE id = 1`,
  );
  return rows[0];
}

export async function listExchangeRateHistory() {
  const { rows } = await query(
    `SELECT old_rate, new_rate, note, changed_at
     FROM exchange_rate_history ORDER BY changed_at DESC LIMIT 30`,
  );
  return rows;
}

export async function updateExchangeRate(
  rate: number,
  note: string | null,
  adminId: string,
) {
  const { before, after } = await withTransaction(async (client) => {
    const current = await client.query(
      `SELECT syp_per_usd, note, updated_at FROM exchange_rate_settings WHERE id = 1 FOR UPDATE`,
    );
    const before = current.rows[0];
    const updated = await client.query(
      `UPDATE exchange_rate_settings
       SET syp_per_usd = $1, note = $2, updated_by = $3, updated_at = NOW()
       WHERE id = 1 RETURNING syp_per_usd, note, updated_at`,
      [rate, note, adminId],
    );
    await client.query(
      `INSERT INTO exchange_rate_history (old_rate, new_rate, note, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [before.syp_per_usd, rate, note, adminId],
    );
    return { before, after: updated.rows[0] };
  });
  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'exchange_rate.update',
    entityType: 'exchange_rate_settings',
    beforeData: before,
    afterData: after,
  });
  return after;
}
