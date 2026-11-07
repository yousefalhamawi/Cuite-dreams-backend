import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../config/database';
import { notFound, badRequest } from '../utils/errors';
import { writeAudit } from './audit.service';

export async function listZones(activeOnly = true) {
  const { rows } = await query(
    `SELECT z.*,
       (SELECT json_agg(json_build_object(
          'id', r.id,
          'shipping_fee', r.shipping_fee,
          'free_shipping_threshold', r.free_shipping_threshold,
          'currency', r.currency,
          'is_active', r.is_active
        ) ORDER BY CASE WHEN r.currency = 'SAR' THEN 0 ELSE 1 END, r.created_at DESC)
        FROM shipping_rules r
        WHERE r.zone_id = z.id AND r.is_active = TRUE
       ) AS rules
     FROM shipping_zones z
     WHERE ($1::boolean = FALSE OR z.is_active = TRUE)
     ORDER BY z.name`,
    [activeOnly],
  );
  return rows;
}

export async function quoteShipping(zoneId: string, subtotal: number, currency = 'SAR') {
  const { rows } = await query<{
    shipping_fee: string;
    free_shipping_threshold: string | null;
    currency: string;
    zone_name: string;
    zone_code: string;
  }>(
    `SELECT r.shipping_fee, r.free_shipping_threshold, r.currency, z.name AS zone_name, z.code AS zone_code
     FROM shipping_rules r
     JOIN shipping_zones z ON z.id = r.zone_id
     WHERE r.zone_id = $1 AND r.currency IN ($2, 'SYP') AND r.is_active = TRUE AND z.is_active = TRUE
     ORDER BY CASE WHEN r.currency = $2 THEN 0 ELSE 1 END, r.created_at DESC
     LIMIT 1`,
    [zoneId, currency],
  );
  const rule = rows[0];
  if (!rule) throw notFound('Shipping rule not found for zone');

  const fee = Number(rule.shipping_fee);
  const threshold = rule.free_shipping_threshold
    ? Number(rule.free_shipping_threshold)
    : null;
  const shippingCost = threshold !== null && subtotal >= threshold ? 0 : fee;

  return {
    zoneId,
    zoneName: rule.zone_name,
    zoneCode: rule.zone_code,
    currency: rule.currency,
    shippingFee: fee,
    freeShippingThreshold: threshold,
    shippingCost,
  };
}

export async function createZone(
  data: { name: string; shipping_fee: number; free_shipping_threshold?: number | null; neighborhoods?: string[] },
  adminId: string,
) {
  const result = await withTransaction(async (client) => {
    const { rows: zones } = await client.query(
      `INSERT INTO shipping_zones (name, code, neighborhoods)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.name.trim(), `AREA-${randomUUID().slice(0, 12).toUpperCase()}`, data.neighborhoods ?? []],
    );
    const { rows: rules } = await client.query(
      `INSERT INTO shipping_rules (zone_id, shipping_fee, free_shipping_threshold, currency)
       VALUES ($1, $2, $3, 'SAR') RETURNING *`,
      [zones[0].id, data.shipping_fee, data.free_shipping_threshold ?? null],
    );
    return { zone: zones[0], rule: rules[0] };
  });
  await writeAudit({
    actorType: 'admin', actorId: adminId, action: 'shipping_zone.create',
    entityType: 'shipping_zones', entityId: result.zone.id, afterData: result,
  });
  return result.zone;
}

export async function updateZoneNeighborhoods(zoneId: string, neighborhoods: string[], adminId: string) {
  const { rows } = await query(
    `UPDATE shipping_zones SET neighborhoods = $1 WHERE id = $2 RETURNING *`,
    [neighborhoods, zoneId],
  );
  if (!rows[0]) throw notFound('Shipping zone not found');
  await writeAudit({
    actorType: 'admin', actorId: adminId, action: 'shipping_zone.neighborhoods.update',
    entityType: 'shipping_zones', entityId: zoneId, afterData: rows[0],
  });
  return rows[0];
}

export async function upsertShippingRule(
  data: {
    zone_id: string;
    shipping_fee: number;
    free_shipping_threshold?: number | null;
    currency?: string;
    is_active?: boolean;
  },
  adminId: string,
) {
  const currency = data.currency ?? 'SYP';

  // Soft-deactivate existing active rule for zone+currency, then insert
  await query(
    `UPDATE shipping_rules SET is_active = FALSE
     WHERE zone_id = $1 AND currency = $2 AND is_active = TRUE`,
    [data.zone_id, currency],
  );

  const { rows } = await query(
    `INSERT INTO shipping_rules (zone_id, shipping_fee, free_shipping_threshold, currency, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      data.zone_id,
      data.shipping_fee,
      data.free_shipping_threshold ?? null,
      currency,
      data.is_active ?? true,
    ],
  );

  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'shipping_rule.upsert',
    entityType: 'shipping_rules',
    entityId: rows[0].id,
    afterData: rows[0],
  });
  return rows[0];
}

export async function setZoneActive(
  zoneId: string,
  isActive: boolean,
  adminId: string,
) {
  const { rows } = await query(
    `UPDATE shipping_zones SET is_active = $1 WHERE id = $2 RETURNING *`,
    [isActive, zoneId],
  );
  if (!rows[0]) throw notFound('Shipping zone not found');
  if (isActive === false && rows[0].code === 'SY') {
    throw badRequest('Cannot deactivate Syria shipping zone');
  }
  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'shipping_zone.update',
    entityType: 'shipping_zones',
    entityId: zoneId,
    afterData: rows[0],
  });
  return rows[0];
}
