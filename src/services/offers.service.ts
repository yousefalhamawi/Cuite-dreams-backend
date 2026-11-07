import { query, withTransaction } from '../config/database';
import { notFound } from '../utils/errors';
import { writeAudit } from './audit.service';
import { slugifyEn, uniqueSlug } from '../utils/slug';

async function offerSlugTaken(slug: string, exceptId?: string) {
  const { rows } = await query(
    `SELECT 1 FROM offers WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`,
    [slug, exceptId ?? null],
  );
  return rows.length > 0;
}

export async function listActiveOffers() {
  const { rows } = await query(
    `SELECT o.*,
       COALESCE(json_agg(
         json_build_object(
           'product_id', op.product_id,
           'offer_rate', op.offer_rate,
           'name_ar', p.name_ar,
           'name_en', p.name_en,
           'slug_ar', p.slug_ar,
           'slug_en', p.slug_en,
           'price', p.price,
           'sku', p.sku
         )
       ) FILTER (WHERE op.id IS NOT NULL), '[]') AS products
     FROM offers o
     LEFT JOIN offer_products op ON op.offer_id = o.id
     LEFT JOIN products p ON p.id = op.product_id AND p.is_active = TRUE
     WHERE o.is_active = TRUE
       AND o.start_date <= NOW()
       AND o.end_date >= NOW()
     GROUP BY o.id
     ORDER BY o.start_date DESC`,
  );
  return rows;
}

export async function listAllOffers(filters: { page?: number; limit?: number } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const count = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM offers`,
  );
  const { rows } = await query(
    `SELECT o.*,
       COALESCE(json_agg(
         json_build_object(
           'product_id', op.product_id,
           'offer_rate', op.offer_rate,
           'name_ar', p.name_ar,
           'name_en', p.name_en,
           'slug_ar', p.slug_ar,
           'slug_en', p.slug_en,
           'price', p.price,
           'sku', p.sku
         )
       ) FILTER (WHERE op.id IS NOT NULL), '[]') AS products
     FROM offers o
     LEFT JOIN offer_products op ON op.offer_id = o.id
     LEFT JOIN products p ON p.id = op.product_id
     GROUP BY o.id
     ORDER BY o.start_date DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const total = Number(count.rows[0].count);
  return { items: rows, page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
}

export async function getOfferBySlug(slug: string) {
  const { rows } = await query(
    `SELECT o.*,
       COALESCE(json_agg(
         json_build_object(
           'product_id', op.product_id,
           'offer_rate', op.offer_rate,
           'name_ar', p.name_ar,
           'name_en', p.name_en,
           'slug_ar', p.slug_ar,
           'slug_en', p.slug_en,
           'price', p.price,
           'sku', p.sku
         )
       ) FILTER (WHERE op.id IS NOT NULL), '[]') AS products
     FROM offers o
     LEFT JOIN offer_products op ON op.offer_id = o.id
     LEFT JOIN products p ON p.id = op.product_id AND p.is_active = TRUE
     WHERE o.slug = $1
     GROUP BY o.id`,
    [slug],
  );
  if (!rows[0]) throw notFound('Offer not found');
  return rows[0];
}

export async function createOffer(
  data: {
    name: string;
    description?: string;
    image_url?: string | null;
    start_date: string;
    end_date: string;
    is_active?: boolean;
    products?: Array<{ product_id: string; offer_rate: number }>;
  },
  adminId: string,
) {
  const slug = await uniqueSlug(slugifyEn(data.name), (s) => offerSlugTaken(s));
  const { rows } = await query(
    `INSERT INTO offers (name, description, image_url, slug, start_date, end_date, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      data.name,
      data.description ?? null,
      data.image_url ?? null,
      slug,
      data.start_date,
      data.end_date,
      data.is_active ?? true,
    ],
  );
  const offer = rows[0];

  if (data.products?.length) {
    for (const p of data.products) {
      await query(
        `INSERT INTO offer_products (offer_id, product_id, offer_rate)
         VALUES ($1, $2, $3)
         ON CONFLICT (offer_id, product_id) DO UPDATE SET offer_rate = EXCLUDED.offer_rate`,
        [offer.id, p.product_id, p.offer_rate],
      );
    }
  }

  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'offer.create',
    entityType: 'offers',
    entityId: offer.id,
    afterData: offer,
  });
  return offer;
}

export async function patchOffer(
  id: string,
  patch: Record<string, unknown>,
  adminId: string,
) {
  const allowed = ['name', 'description', 'image_url', 'start_date', 'end_date', 'is_active'] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      sets.push(`${key} = $${i++}`);
      vals.push(patch[key]);
    }
  }
  if (sets.length === 0) {
    const { rows } = await query(`SELECT * FROM offers WHERE id = $1`, [id]);
    if (!rows[0]) throw notFound('Offer not found');
    return rows[0];
  }
  const before = await query(`SELECT * FROM offers WHERE id = $1`, [id]);
  if (!before.rows[0]) throw notFound('Offer not found');
  vals.push(id);
  const { rows } = await query(
    `UPDATE offers SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals,
  );
  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'offer.update',
    entityType: 'offers',
    entityId: id,
    beforeData: before.rows[0],
    afterData: rows[0],
  });
  return rows[0];
}

export async function deleteOffer(id: string, adminId: string) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM offers WHERE id = $1`, [id]);
    if (!rows[0]) throw notFound('Offer not found');

    await client.query(`DELETE FROM offer_products WHERE offer_id = $1`, [id]);
    await client.query(`DELETE FROM offers WHERE id = $1`, [id]);

    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'offer.delete',
      entityType: 'offers',
      entityId: id,
      beforeData: rows[0],
    });
    return rows[0];
  });
}

export async function createCoupon(
  data: {
    code: string;
    discount_rate: number;
    min_order_value?: number;
    max_uses?: number | null;
    expires_at?: string | null;
    applies_to_offer_id?: string | null;
    is_active?: boolean;
  },
  adminId: string,
) {
  const { rows } = await query(
    `INSERT INTO coupons
      (code, discount_rate, min_order_value, max_uses, expires_at, applies_to_offer_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      data.code.toUpperCase(),
      data.discount_rate,
      data.min_order_value ?? 0,
      data.max_uses ?? null,
      data.expires_at ?? null,
      data.applies_to_offer_id ?? null,
      data.is_active ?? true,
    ],
  );
  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'coupon.create',
    entityType: 'coupons',
    entityId: rows[0].id,
    afterData: rows[0],
  });
  return rows[0];
}

export async function listCouponsAdmin(filters: { page?: number; limit?: number } = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const count = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM coupons`,
  );
  const { rows } = await query(
    `SELECT id, code, discount_rate, min_order_value, max_uses, uses_count,
            expires_at, applies_to_offer_id, is_active, created_at
     FROM coupons ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const total = Number(count.rows[0].count);
  return { items: rows, page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
}

export async function deleteCoupon(id: string, adminId: string) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM coupons WHERE id = $1`, [id]);
    if (!rows[0]) throw notFound('Coupon not found');

    await client.query(`DELETE FROM coupon_usage WHERE coupon_id = $1`, [id]);
    await client.query(`DELETE FROM coupons WHERE id = $1`, [id]);

    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'coupon.delete',
      entityType: 'coupons',
      entityId: id,
      beforeData: rows[0],
    });
    return rows[0];
  });
}

export async function patchCoupon(
  id: string,
  patch: Record<string, unknown>,
  adminId: string,
) {
  const allowed = [
    'discount_rate',
    'min_order_value',
    'max_uses',
    'expires_at',
    'applies_to_offer_id',
    'is_active',
  ] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      sets.push(`${key} = $${i++}`);
      vals.push(patch[key]);
    }
  }
  if (sets.length === 0) {
    const { rows } = await query(`SELECT * FROM coupons WHERE id = $1`, [id]);
    if (!rows[0]) throw notFound('Coupon not found');
    return rows[0];
  }
  vals.push(id);
  const { rows } = await query(
    `UPDATE coupons SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals,
  );
  if (!rows[0]) throw notFound('Coupon not found');
  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'coupon.update',
    entityType: 'coupons',
    entityId: id,
    afterData: rows[0],
  });
  return rows[0];
}

export async function validateCouponPublic(code: string, subtotal: number) {
  const { rows } = await query<{
    code: string;
    discount_rate: string;
    min_order_value: string;
    expires_at: Date | null;
    is_active: boolean;
    max_uses: number | null;
    uses_count: number;
  }>(
    `SELECT code, discount_rate, min_order_value, expires_at, is_active, max_uses, uses_count
     FROM coupons WHERE UPPER(code) = UPPER($1)`,
    [code],
  );
  const c = rows[0];
  if (!c?.is_active) throw notFound('Coupon not found');
  if (c.expires_at && c.expires_at < new Date()) throw notFound('Coupon not found');
  if (c.max_uses !== null && c.uses_count >= c.max_uses) throw notFound('Coupon not found');

  const eligible = subtotal >= Number(c.min_order_value);
  const discount = eligible
    ? Math.round(subtotal * (Number(c.discount_rate) / 100) * 100) / 100
    : 0;

  return {
    code: c.code,
    discount_rate: Number(c.discount_rate),
    min_order_value: Number(c.min_order_value),
    eligible,
    estimated_discount: discount,
  };
}
