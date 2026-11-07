import { query } from '../config/database';
import { badRequest, notFound } from '../utils/errors';
import { packagingExtra } from '../utils/packaging';

export interface CartItemRow {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  variant_ids?: unknown;
  quantity: number;
  unit_price: string | number;
  name_ar?: string;
  name_en?: string;
  slug_ar?: string;
  slug_en?: string;
  sku?: string;
  image_url?: string | null;
  packaging_id?: string | null;
  customizations?: Array<Record<string, unknown>>;
  variants?: unknown[];
}

async function resolveCart(owner: {
  customerId?: string;
  sessionId?: string;
}): Promise<string> {
  if (owner.customerId) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM carts WHERE customer_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [owner.customerId],
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const created = await query<{ id: string }>(
      `INSERT INTO carts (customer_id) VALUES ($1) RETURNING id`,
      [owner.customerId],
    );
    return created.rows[0].id;
  }

  if (!owner.sessionId) throw badRequest('sessionId or authentication required');

  const existing = await query<{ id: string }>(
    `SELECT id FROM carts WHERE session_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [owner.sessionId],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await query<{ id: string }>(
    `INSERT INTO carts (session_id) VALUES ($1) RETURNING id`,
    [owner.sessionId],
  );
  return created.rows[0].id;
}

export async function getCart(owner: { customerId?: string; sessionId?: string }) {
  const cartId = await resolveCart(owner);
  const { rows: items } = await query<CartItemRow>(
    `SELECT ci.*, p.name_ar, p.name_en, p.sku, p.slug_ar, p.slug_en,
       (SELECT image_url FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.is_primary DESC, pi.display_order ASC LIMIT 1) AS image_url
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1
     ORDER BY ci.created_at ASC`,
    [cartId],
  );

  const customizations = await query<{ cart_item_id: string } & Record<string, unknown>>(
    `SELECT cic.*, pc.customization_type, pc.extra_price
     FROM cart_item_customizations cic
     JOIN cart_items ci ON ci.id = cic.cart_item_id
     JOIN product_customizations pc ON pc.id = cic.customization_id
     WHERE ci.cart_id = $1`,
    [cartId],
  );

  const variantRows = await query<{
    id: string;
    variant_type: string;
    value: string;
    price_modifier: string;
  }>(
    `SELECT id, variant_type, value, price_modifier FROM product_variants
     WHERE id IN (
       SELECT DISTINCT jsonb_array_elements_text(ci.variant_ids)::uuid
       FROM cart_items ci WHERE ci.cart_id = $1 AND jsonb_typeof(ci.variant_ids) = 'array'
     )`,
    [cartId],
  );
  const variantsById = new Map(variantRows.rows.map((v) => [v.id, v]));

  const byItem = new Map<string, Array<Record<string, unknown>>>();
  for (const c of customizations.rows) {
    const list = byItem.get(c.cart_item_id) ?? [];
    list.push(c);
    byItem.set(c.cart_item_id, list);
  }

  const enriched: CartItemRow[] = items.map((item) => {
    const ids = Array.isArray(item.variant_ids)
      ? (item.variant_ids as unknown as string[])
      : [];
    return {
      ...item,
      customizations: byItem.get(item.id) ?? [],
      variants: ids.map((id) => variantsById.get(id)).filter(Boolean),
    };
  });

  const subtotal = enriched.reduce(
    (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
    0,
  );

  return { id: cartId, items: enriched, subtotal };
}

export async function addCartItem(
  owner: { customerId?: string; sessionId?: string },
  input: {
    product_id: string;
    variant_id?: string | null;
    variant_ids?: string[];
    packaging_id?: string;
    quantity: number;
    customizations?: Array<{
      customization_id: string;
      custom_text?: string;
      father_name?: string;
      chosen_color?: string;
      chosen_design?: string;
      notes?: string;
    }>;
  },
) {
  const cartId = await resolveCart(owner);

  const product = await query<{ id: string; price: string; is_active: boolean }>(
    `SELECT id, price, is_active FROM products WHERE id = $1`,
    [input.product_id],
  );
  if (!product.rows[0]?.is_active) throw notFound('Product not found');

  let unitPrice = Number(product.rows[0].price);
  const variantIds = [
    ...new Set(
      [...(input.variant_ids ?? []), input.variant_id].filter((id): id is string => Boolean(id)),
    ),
  ];
  const primaryVariantId = variantIds[0] ?? null;

  for (const variantId of variantIds) {
    const variant = await query<{
      price_modifier: string;
      stock_qty: number;
      is_active: boolean;
      product_id: string;
    }>(
      `SELECT price_modifier, stock_qty, is_active, product_id FROM product_variants WHERE id = $1`,
      [variantId],
    );
    const v = variant.rows[0];
    if (!v || !v.is_active || v.product_id !== input.product_id) {
      throw badRequest('Invalid variant');
    }
    if (v.stock_qty < input.quantity) throw badRequest('Insufficient stock');
    unitPrice += Number(v.price_modifier);
  }

  if (input.customizations?.length) {
    for (const c of input.customizations) {
      const cust = await query<{
        extra_price: string;
        is_required: boolean;
        max_characters: number | null;
        product_id: string;
        is_active: boolean;
      }>(
        `SELECT extra_price, is_required, max_characters, product_id, is_active
         FROM product_customizations WHERE id = $1`,
        [c.customization_id],
      );
      const row = cust.rows[0];
      if (!row?.is_active || row.product_id !== input.product_id) {
        throw badRequest('Invalid customization');
      }
      if (row.max_characters && c.custom_text && c.custom_text.length > row.max_characters) {
        throw badRequest('Customization text too long');
      }
      unitPrice += Number(row.extra_price);
    }
  }

  unitPrice += packagingExtra(input.packaging_id);

  const { rows } = await query(
    `INSERT INTO cart_items (cart_id, product_id, variant_id, variant_ids, packaging_id, quantity, unit_price)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7) RETURNING *`,
    [
      cartId,
      input.product_id,
      primaryVariantId,
      JSON.stringify(variantIds),
      input.packaging_id ?? null,
      input.quantity,
      unitPrice,
    ],
  );
  const item = rows[0];

  if (input.customizations?.length) {
    for (const c of input.customizations) {
      await query(
        `INSERT INTO cart_item_customizations
          (cart_item_id, customization_id, custom_text, father_name, chosen_color, chosen_design, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          item.id,
          c.customization_id,
          c.custom_text ?? null,
          c.father_name ?? null,
          c.chosen_color ?? null,
          c.chosen_design ?? null,
          c.notes ?? null,
        ],
      );
    }
  }

  await query(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
  return getCart(owner);
}

export async function updateCartItemQuantity(
  owner: { customerId?: string; sessionId?: string },
  itemId: string,
  quantity: number,
) {
  const cart = await getCart(owner);
  const { rowCount } = await query(
    `UPDATE cart_items SET quantity = $1, updated_at = NOW()
     WHERE id = $2 AND cart_id = $3`,
    [quantity, itemId, cart.id],
  );
  if (!rowCount) throw notFound('Cart item not found');
  return getCart(owner);
}

export async function removeCartItem(
  owner: { customerId?: string; sessionId?: string },
  itemId: string,
) {
  const cart = await getCart(owner);
  const { rowCount } = await query(
    `DELETE FROM cart_items WHERE id = $1 AND cart_id = $2`,
    [itemId, cart.id],
  );
  if (!rowCount) throw notFound('Cart item not found');
  return getCart(owner);
}

export async function mergeSessionCartIntoCustomer(
  sessionId: string,
  customerId: string,
): Promise<void> {
  if (!sessionId) return;

  const sessionCart = await query<{ id: string }>(
    `SELECT id FROM carts WHERE session_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [sessionId],
  );
  if (!sessionCart.rows[0]) return;

  const customerCartId = await resolveCart({ customerId });
  const sessionCartId = sessionCart.rows[0].id;
  if (sessionCartId === customerCartId) return;

  await query(`UPDATE cart_items SET cart_id = $1 WHERE cart_id = $2`, [
    customerCartId,
    sessionCartId,
  ]);
  await query(`DELETE FROM carts WHERE id = $1`, [sessionCartId]);
  await query(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [customerCartId]);
}

export async function clearCart(cartId: string): Promise<void> {
  await query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
}
