import type { PoolClient } from 'pg';
import { withTransaction, query } from '../config/database';
import { badRequest, conflict, notFound } from '../utils/errors';
import { generateOrderNumber } from '../utils/helpers';
import { findOrCreateGuestCustomer } from './auth.service';
import { getCart, clearCart } from './cart.service';
import { quoteShipping } from './shipping.service';
import { writeAudit } from './audit.service';
import type { OrderStatus, PaymentMethod } from '../types';
import { packagingLabel } from '../utils/packaging';

interface CheckoutInput {
  customerId?: string;
  sessionId?: string;
  shipping_zone_id: string;
  payment_method: PaymentMethod;
  coupon_code?: string;
  notes?: string;
  idempotency_key?: string;
  payment_receipt_url?: string;
  payment_receipt_key?: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    city: string;
    country?: string;
  };
}

async function applyCoupon(
  client: PoolClient,
  code: string | undefined,
  subtotal: number,
): Promise<{ couponId: string | null; discount: number }> {
  if (!code) return { couponId: null, discount: 0 };

  const { rows } = await client.query<{
    id: string;
    discount_rate: string;
    min_order_value: string;
    max_uses: number | null;
    uses_count: number;
    expires_at: Date | null;
    is_active: boolean;
  }>(
    `SELECT id, discount_rate, min_order_value, max_uses, uses_count, expires_at, is_active
     FROM coupons WHERE UPPER(code) = UPPER($1) FOR UPDATE`,
    [code],
  );
  const coupon = rows[0];
  if (!coupon?.is_active) throw badRequest('Invalid coupon');
  if (coupon.expires_at && coupon.expires_at < new Date()) {
    throw badRequest('Coupon expired');
  }
  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    throw badRequest('Coupon usage limit reached');
  }
  if (subtotal < Number(coupon.min_order_value)) {
    throw badRequest('Order below coupon minimum');
  }

  const discount =
    Math.round(subtotal * (Number(coupon.discount_rate) / 100) * 100) / 100;

  await client.query(
    `UPDATE coupons SET uses_count = uses_count + 1 WHERE id = $1`,
    [coupon.id],
  );

  return { couponId: coupon.id, discount };
}

export async function checkout(input: CheckoutInput) {
  return withTransaction(async (client) => {
    if (input.idempotency_key && input.customerId) {
      const existing = await client.query(
        `SELECT * FROM orders WHERE customer_id = $1 AND idempotency_key = $2`,
        [input.customerId, input.idempotency_key],
      );
      if (existing.rows[0]) return existing.rows[0];
    }

    const cart = await getCart({
      customerId: input.customerId,
      sessionId: input.sessionId,
    });
    if (!cart.items.length) throw badRequest('Cart is empty');

    const country = input.customer.country ?? 'SY';
    const customerId =
      input.customerId ??
      (await findOrCreateGuestCustomer(client, {
        ...input.customer,
        address: input.customer.address,
        city: input.customer.city,
        country,
      }));

    // Re-price & stock check inside transaction
    let subtotal = 0;
    for (const item of cart.items) {
      const product = await client.query<{
        price: string;
        is_active: boolean;
        name_ar: string;
        name_en: string;
      }>(
        `SELECT price, is_active, name_ar, name_en FROM products WHERE id = $1 FOR UPDATE`,
        [item.product_id],
      );
      if (!product.rows[0]?.is_active) {
        throw badRequest(`Product unavailable: ${item.product_id}`);
      }

      if (item.variant_id) {
        const v = await client.query<{ stock_qty: number; is_active: boolean }>(
          `SELECT stock_qty, is_active FROM product_variants WHERE id = $1 FOR UPDATE`,
          [item.variant_id],
        );
        if (!v.rows[0]?.is_active || v.rows[0].stock_qty < Number(item.quantity)) {
          throw badRequest('Insufficient stock for a cart item');
        }
      }

      subtotal += Number(item.unit_price) * Number(item.quantity);
    }

    const shipping = await quoteShipping(
      input.shipping_zone_id,
      subtotal,
      'SYP',
    );

    const { couponId, discount } = await applyCoupon(
      client,
      input.coupon_code,
      subtotal,
    );

    const total = Math.max(0, subtotal + shipping.shippingCost - discount);
    const orderNumber = generateOrderNumber();

    let order;
    try {
      const inserted = await client.query(
        `INSERT INTO orders (
           customer_id, order_number, status, payment_method,
           subtotal, shipping_cost, discount_total, total, currency,
           shipping_zone_id, coupon_id, notes,
           shipping_address, shipping_city, shipping_country, idempotency_key,
           payment_receipt_url, payment_receipt_key
         ) VALUES (
           $1,$2,'pending',$3,$4,$5,$6,$7,'SYP',$8,$9,$10,$11,$12,$13,$14,$15,$16
         ) RETURNING *`,
        [
          customerId,
          orderNumber,
          input.payment_method,
          subtotal,
          shipping.shippingCost,
          discount,
          total,
          input.shipping_zone_id,
          couponId,
          input.notes ?? null,
          input.customer.address,
          input.customer.city,
          country,
          input.idempotency_key ?? null,
          input.payment_receipt_url ?? null,
          input.payment_receipt_key ?? null,
        ],
      );
      order = inserted.rows[0];
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === '23505' &&
        input.idempotency_key
      ) {
        const again = await client.query(
          `SELECT * FROM orders WHERE customer_id = $1 AND idempotency_key = $2`,
          [customerId, input.idempotency_key],
        );
        if (again.rows[0]) return again.rows[0];
        throw conflict('Idempotency key conflict');
      }
      throw err;
    }

    for (const item of cart.items) {
      const product = await client.query<{ name_ar: string; name_en: string }>(
        `SELECT name_ar, name_en FROM products WHERE id = $1`,
        [item.product_id],
      );
      const lineTotal = Number(item.unit_price) * Number(item.quantity);
      const oi = await client.query<{ id: string }>(
        `INSERT INTO order_items
          (order_id, product_id, variant_id, quantity, unit_price, line_total, product_name_ar, product_name_en, packaging_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          order.id,
          item.product_id,
          item.variant_id,
          item.quantity,
          item.unit_price,
          lineTotal,
          product.rows[0].name_ar,
          product.rows[0].name_en,
          item.packaging_id ?? null,
        ],
      );

      if (item.variant_id) {
        await client.query(
          `UPDATE product_variants SET stock_qty = stock_qty - $1 WHERE id = $2`,
          [item.quantity, item.variant_id],
        );
      }

      const customs = (item.customizations as Array<Record<string, unknown>>) ?? [];
      for (const c of customs) {
        await client.query(
          `INSERT INTO order_item_customizations
            (order_item_id, customization_id, custom_text, chosen_color, chosen_design)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            oi.rows[0].id,
            c.customization_id,
            c.custom_text ?? null,
            c.chosen_color ?? null,
            c.chosen_design ?? null,
          ],
        );
      }
    }

    if (couponId) {
      await client.query(
        `INSERT INTO coupon_usage (coupon_id, order_id, customer_id) VALUES ($1,$2,$3)`,
        [couponId, order.id, customerId],
      );
    }

    await clearCart(cart.id);

    await writeAudit({
      actorType: 'customer',
      actorId: customerId,
      action: 'order.create',
      entityType: 'orders',
      entityId: order.id as string,
      afterData: { order_number: order.order_number, total: order.total },
    });

    return order;
  });
}

export async function getOrderForCustomer(orderId: string, customerId: string) {
  // Ownership in WHERE — return 404 if not owner (no existence leak)
  const { rows } = await query(
    `SELECT * FROM orders WHERE id = $1 AND customer_id = $2`,
    [orderId, customerId],
  );
  if (!rows[0]) throw notFound('Order not found');
  return attachOrderItems(rows[0]);
}

export async function getOrderAdmin(orderId: string) {
  const { rows } = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!rows[0]) throw notFound('Order not found');
  return attachOrderItems(rows[0]);
}

async function attachOrderItems(order: Record<string, unknown>) {
  const items = await query(
    `SELECT oi.*,
            pv.variant_type, pv.value AS variant_value
     FROM order_items oi
     LEFT JOIN product_variants pv ON pv.id = oi.variant_id
     WHERE oi.order_id = $1 ORDER BY oi.created_at`,
    [order.id],
  );
  const customs = await query(
    `SELECT oic.*, pc.customization_type
     FROM order_item_customizations oic
     JOIN order_items oi ON oi.id = oic.order_item_id
     JOIN product_customizations pc ON pc.id = oic.customization_id
     WHERE oi.order_id = $1`,
    [order.id],
  );
  const byItem = new Map<string, unknown[]>();
  for (const c of customs.rows) {
    const list = byItem.get(c.order_item_id as string) ?? [];
    list.push(c);
    byItem.set(c.order_item_id as string, list);
  }
  return {
    ...order,
    items: items.rows.map((i) => ({
      ...i,
      packaging_name: packagingLabel(i.packaging_id as string | null),
      customizations: byItem.get(i.id as string) ?? [],
    })),
  };
}

export async function listOrdersAdmin(filters: {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  let where = '';
  if (filters.status) {
    where = 'WHERE status = $1';
    params.push(filters.status);
  }
  const count = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM orders ${where}`,
    params,
  );
  const { rows } = await query(
    `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  const stats = await query<{ pending: string; revenue: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
       COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0)::text AS revenue
     FROM orders`,
  );
  const total = Number(count.rows[0].count);
  return {
    items: rows,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    pending: Number(stats.rows[0].pending),
    revenue: Number(stats.rows[0].revenue),
  };
}

export async function listOrdersForCustomer(customerId: string) {
  const { rows } = await query(
    `SELECT id, order_number, status, total, currency, created_at,
            (SELECT COALESCE(SUM(quantity), 0)::int FROM order_items WHERE order_id = orders.id) AS item_count
     FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`,
    [customerId],
  );
  return rows;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  adminId: string,
) {
  const before = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!before.rows[0]) throw notFound('Order not found');

  const { rows } = await query(
    `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
    [status, orderId],
  );

  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'order.status_update',
    entityType: 'orders',
    entityId: orderId,
    beforeData: { status: before.rows[0].status },
    afterData: { status: rows[0].status },
  });
  return rows[0];
}

export async function cancelOrderAdmin(orderId: string, adminId: string) {
  const { rows: existing } = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!existing[0]) throw notFound('Order not found');
  if (existing[0].status === 'cancelled') throw badRequest('Order is already cancelled');
  if (existing[0].status === 'delivered') throw badRequest('Cannot cancel a delivered order');

  const { rows } = await query(
    `UPDATE orders SET status = 'cancelled' WHERE id = $1 RETURNING *`,
    [orderId],
  );

  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'order.cancel',
    entityType: 'orders',
    entityId: orderId,
    beforeData: { status: existing[0].status },
    afterData: { status: rows[0].status },
  });
  return rows[0];
}

export async function deleteOrderAdmin(orderId: string, adminId: string) {
  return withTransaction(async (client) => {
    const { rows: existing } = await client.query(`SELECT * FROM orders WHERE id = $1`, [
      orderId,
    ]);
    if (!existing[0]) throw notFound('Order not found');

    const items = await client.query<{ id: string }>(
      `SELECT id FROM order_items WHERE order_id = $1`,
      [orderId],
    );
    const itemIds = items.rows.map((row) => row.id);

    if (itemIds.length) {
      await client.query(`DELETE FROM reviews WHERE order_item_id = ANY($1::uuid[])`, [
        itemIds,
      ]);
    }
    await client.query(`DELETE FROM coupon_usage WHERE order_id = $1`, [orderId]);
    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
    await client.query(`DELETE FROM orders WHERE id = $1`, [orderId]);

    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'order.delete',
      entityType: 'orders',
      entityId: orderId,
      beforeData: existing[0],
    });
    return existing[0];
  });
}
