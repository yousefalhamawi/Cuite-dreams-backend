import { query, withTransaction } from '../config/database';
import { conflict, notFound } from '../utils/errors';
import type { PaginatedResult } from '../types';
import { writeAudit } from './audit.service';
import { isUuid, slugifyAr, slugifyEn, uniqueSlug } from '../utils/slug';

async function slugEnTaken(table: 'categories' | 'products', slug: string, exceptId?: string) {
  const { rows } = await query(
    `SELECT 1 FROM ${table} WHERE slug_en = $1 AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`,
    [slug, exceptId ?? null],
  );
  return rows.length > 0;
}

async function slugArTaken(table: 'categories' | 'products', slug: string, exceptId?: string) {
  const { rows } = await query(
    `SELECT 1 FROM ${table} WHERE slug_ar = $1 AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`,
    [slug, exceptId ?? null],
  );
  return rows.length > 0;
}

async function makeSlugs(
  table: 'categories' | 'products',
  nameEn: string,
  nameAr: string,
  exceptId?: string,
) {
  const slug_en = await uniqueSlug(slugifyEn(nameEn), (s) => slugEnTaken(table, s, exceptId));
  const slug_ar = await uniqueSlug(slugifyAr(nameAr), (s) => slugArTaken(table, s, exceptId));
  return { slug_en, slug_ar };
}

export async function listCategories(activeOnly = true) {
  const { rows } = await query(
    `SELECT c.id, c.name_ar, c.name_en, c.slug_ar, c.slug_en, c.parent_id, c.display_order,
            c.image_url, c.is_active,
            (SELECT COUNT(*)::int FROM products p
             WHERE p.category_id = c.id AND p.is_active = TRUE) AS product_count
     FROM categories c
     WHERE ($1::boolean = FALSE OR c.is_active = TRUE)
     ORDER BY c.display_order ASC, c.name_en ASC`,
    [activeOnly],
  );
  return rows;
}

export async function getCategory(idOrSlug: string) {
  const { rows } = isUuid(idOrSlug)
    ? await query(`SELECT * FROM categories WHERE id = $1`, [idOrSlug])
    : await query(`SELECT * FROM categories WHERE slug_en = $1 OR slug_ar = $1`, [idOrSlug]);
  if (!rows[0]) throw notFound('Category not found');
  return rows[0];
}

export async function createCategory(
  data: {
    name_ar: string;
    name_en: string;
    parent_id?: string | null;
    display_order?: number;
    image_url?: string | null;
    is_active?: boolean;
  },
  adminId: string,
) {
  const slugs = await makeSlugs('categories', data.name_en, data.name_ar);
  const { rows } = await query(
    `INSERT INTO categories (name_ar, name_en, slug_ar, slug_en, parent_id, display_order, image_url, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.name_ar,
      data.name_en,
      slugs.slug_ar,
      slugs.slug_en,
      data.parent_id ?? null,
      data.display_order ?? 0,
      data.image_url ?? null,
      data.is_active ?? true,
    ],
  );
  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'category.create',
    entityType: 'categories',
    entityId: rows[0].id,
    afterData: rows[0],
  });
  return rows[0];
}

/** Explicit field whitelist update */
export async function patchCategory(
  id: string,
  patch: Record<string, unknown>,
  adminId: string,
) {
  const allowed = [
    'name_ar',
    'name_en',
    'parent_id',
    'display_order',
    'image_url',
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

  const nameEn = (patch.name_en as string | undefined) ?? undefined;
  const nameAr = (patch.name_ar as string | undefined) ?? undefined;
  if (nameEn || nameAr) {
    const current = await getCategory(id);
    const slugs = await makeSlugs(
      'categories',
      nameEn ?? (current.name_en as string),
      nameAr ?? (current.name_ar as string),
      id,
    );
    sets.push(`slug_en = $${i++}`);
    vals.push(slugs.slug_en);
    sets.push(`slug_ar = $${i++}`);
    vals.push(slugs.slug_ar);
  }
  if (sets.length === 0) return getCategory(id);

  const before = await getCategory(id);
  vals.push(id);
  const { rows } = await query(
    `UPDATE categories SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals,
  );
  if (!rows[0]) throw notFound('Category not found');
  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'category.update',
    entityType: 'categories',
    entityId: id,
    beforeData: before,
    afterData: rows[0],
  });
  return rows[0];
}

export async function listProducts(filters: {
  categoryId?: string;
  categorySlug?: string;
  bestseller?: boolean;
  q?: string;
  sort?: string;
  page?: number;
  limit?: number;
  activeOnly?: boolean;
  excludeId?: string;
  minPrice?: number;
  maxPrice?: number;
  colors?: string[];
  sizes?: string[];
  stockStatus?: 'low' | 'out';
  includeStock?: boolean;
}): Promise<PaginatedResult<unknown> & { facets: unknown[]; priceRange: { min: number; max: number } }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;
  const activeOnly = filters.activeOnly !== false;

  const where: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  // Delivery-time variants are artificial choices with very large stock.
  // A simple product's `standard` row is ignored when real options exist.
  const stockable = (alias: string) => `${alias}.is_active = TRUE AND NOT (
    ${alias}.variant_type = 'style' AND (
      ${alias}.value LIKE 'توصيل سريع (%' OR ${alias}.value LIKE 'توصيل عادي (%'
    )
  )`;
  const inventoryVariant = `${stockable('v')} AND NOT (
    v.variant_type = 'style' AND v.value = 'standard' AND EXISTS (
      SELECT 1 FROM product_variants v_other
      WHERE v_other.product_id = p.id AND ${stockable('v_other')}
        AND NOT (v_other.variant_type = 'style' AND v_other.value = 'standard')
    )
  )`;

  if (activeOnly) {
    where.push(`p.is_active = TRUE`);
  }
  if (filters.categoryId) {
    where.push(`p.category_id = $${i++}`);
    params.push(filters.categoryId);
  }
  if (filters.categorySlug) {
    where.push(
      `p.category_id IN (SELECT id FROM categories WHERE slug_en = $${i} OR slug_ar = $${i})`,
    );
    params.push(filters.categorySlug);
    i++;
  }
  if (filters.bestseller) {
    where.push(`p.is_bestseller = TRUE`);
  }
  if (filters.q) {
    where.push(`(p.name_ar ILIKE $${i} OR p.name_en ILIKE $${i} OR p.sku ILIKE $${i})`);
    params.push(`%${filters.q}%`);
    i++;
  }
  if (filters.excludeId) {
    where.push(`p.id <> $${i++}`);
    params.push(filters.excludeId);
  }
  if (filters.stockStatus === 'low') {
    where.push(`EXISTS (
      SELECT 1 FROM product_variants v
      WHERE v.product_id = p.id AND ${inventoryVariant}
        AND v.stock_qty BETWEEN 1 AND 5
    )`);
  } else if (filters.stockStatus === 'out') {
    where.push(`NOT EXISTS (
      SELECT 1 FROM product_variants v
      WHERE v.product_id = p.id AND ${inventoryVariant}
        AND v.stock_qty > 0
    )`);
  }

  const facetWhere = [...where];
  const facetParams = [...params];

  if (filters.minPrice !== undefined) {
    where.push(`p.price >= $${i++}`);
    params.push(filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    where.push(`p.price <= $${i++}`);
    params.push(filters.maxPrice);
  }
  if (filters.colors?.length) {
    where.push(
      `EXISTS (SELECT 1 FROM product_variants v
        WHERE v.product_id = p.id AND v.variant_type = 'color'
          AND v.is_active = TRUE AND v.value = ANY($${i++}::text[]))`,
    );
    params.push(filters.colors);
  }
  if (filters.sizes?.length) {
    where.push(
      `EXISTS (SELECT 1 FROM product_variants v
        WHERE v.product_id = p.id AND v.variant_type = 'size'
          AND v.is_active = TRUE AND v.value = ANY($${i++}::text[]))`,
    );
    params.push(filters.sizes);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const facetWhereSql = facetWhere.length ? `WHERE ${facetWhere.join(' AND ')}` : '';

  let orderSql = 'ORDER BY p.created_at DESC';
  switch (filters.sort) {
    case 'price-asc':
      orderSql = 'ORDER BY p.price ASC';
      break;
    case 'price-desc':
      orderSql = 'ORDER BY p.price DESC';
      break;
    case 'bestselling':
      orderSql = 'ORDER BY p.is_bestseller DESC, p.created_at DESC';
      break;
    case 'rating':
      orderSql = 'ORDER BY p.avg_rating DESC, p.review_count DESC';
      break;
    default:
      break;
  }

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM products p ${whereSql}`,
    params,
  );
  const total = Number(countRes.rows[0].count);

  const { rows } = await query(
    `SELECT p.*,
       c.slug_en AS category_slug_en,
       c.slug_ar AS category_slug_ar,
       (SELECT image_url FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.is_primary DESC, pi.display_order ASC
        LIMIT 1) AS primary_image,
       (SELECT json_agg(json_build_object('id', v.value, 'label', v.value)
          ORDER BY v.value)
        FROM product_variants v
        WHERE v.product_id = p.id AND v.variant_type = 'color' AND v.is_active = TRUE
       ) AS colors${filters.includeStock ? `,
       (SELECT MIN(v.stock_qty)::int FROM product_variants v
        WHERE v.product_id = p.id AND ${inventoryVariant} AND v.stock_qty > 0
       ) AS lowest_available_stock` : ''}
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ${orderSql}
     LIMIT $${i++} OFFSET $${i}`,
    [...params, limit, offset],
  );

  const [facetRows, priceRows] = await Promise.all([
    query<{ variant_type: string; value: string; count: string }>(
      `SELECT v.variant_type, v.value, COUNT(DISTINCT p.id)::text AS count
       FROM products p
       JOIN product_variants v ON v.product_id = p.id AND v.is_active = TRUE
       ${facetWhereSql ? `${facetWhereSql} AND` : 'WHERE'} v.variant_type IN ('color', 'size')
       GROUP BY v.variant_type, v.value
       ORDER BY v.variant_type, v.value`,
      facetParams,
    ),
    query<{ min: string | null; max: string | null }>(
      `SELECT MIN(p.price)::text AS min, MAX(p.price)::text AS max
       FROM products p ${facetWhereSql}`,
      facetParams,
    ),
  ]);

  const colorValues = facetRows.rows
    .filter((row) => row.variant_type === 'color')
    .map((row) => ({ id: row.value, label: row.value, count: Number(row.count) }));
  const sizeValues = facetRows.rows
    .filter((row) => row.variant_type === 'size')
    .map((row) => ({ id: row.value, label: row.value, count: Number(row.count) }));

  const facets = [];
  if (colorValues.length) {
    facets.push({ id: 'color', kind: 'color', label: 'اللون', values: colorValues });
  }
  if (sizeValues.length) {
    facets.push({ id: 'size', kind: 'size', label: 'المقاس', values: sizeValues });
  }

  return {
    items: rows,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    facets,
    priceRange: {
      min: Number(priceRows.rows[0]?.min ?? 0),
      max: Number(priceRows.rows[0]?.max ?? 0),
    },
  };
}

export async function getProductDetail(idOrSlug: string, activeOnly = true) {
  const { rows } = isUuid(idOrSlug)
    ? await query(
        `SELECT p.*, c.slug_en AS category_slug_en, c.slug_ar AS category_slug_ar
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.id = $1 AND ($2::boolean = FALSE OR p.is_active = TRUE)`,
        [idOrSlug, activeOnly],
      )
    : await query(
        `SELECT p.*, c.slug_en AS category_slug_en, c.slug_ar AS category_slug_ar
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE (p.slug_en = $1 OR p.slug_ar = $1) AND ($2::boolean = FALSE OR p.is_active = TRUE)`,
        [idOrSlug, activeOnly],
      );
  if (!rows[0]) throw notFound('Product not found');
  const id = rows[0].id as string;

  const [images, variants, customizations] = await Promise.all([
    query(
      `SELECT id, image_url, display_order, is_primary FROM product_images
       WHERE product_id = $1 ORDER BY display_order ASC`,
      [id],
    ),
    query(
      `SELECT id, variant_type, value, price_modifier, stock_qty, sku_suffix, is_active
       FROM product_variants WHERE product_id = $1 AND ($2::boolean = FALSE OR is_active = TRUE)
       ORDER BY variant_type, value`,
      [id, activeOnly],
    ),
    query(
      `SELECT id, customization_type, is_required, extra_price, max_characters,
              available_colors, available_fonts, is_active
       FROM product_customizations WHERE product_id = $1 AND ($2::boolean = FALSE OR is_active = TRUE)`,
      [id, activeOnly],
    ),
  ]);

  return {
    ...rows[0],
    images: images.rows,
    variants: variants.rows,
    customizations: customizations.rows,
  };
}

export async function createProduct(
  data: {
    category_id: string;
    sku: string;
    name_ar: string;
    name_en: string;
    description?: string;
    price: number;
    is_active?: boolean;
    is_bestseller?: boolean;
  },
  adminId: string,
) {
  const slugs = await makeSlugs('products', data.name_en, data.name_ar);
  const { rows } = await query(
    `INSERT INTO products
      (category_id, sku, name_ar, name_en, slug_ar, slug_en, description, price, is_active, is_bestseller)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.category_id,
      data.sku,
      data.name_ar,
      data.name_en,
      slugs.slug_ar,
      slugs.slug_en,
      data.description ?? null,
      data.price,
      data.is_active ?? true,
      data.is_bestseller ?? false,
    ],
  );
  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'product.create',
    entityType: 'products',
    entityId: rows[0].id,
    afterData: rows[0],
  });
  return rows[0];
}

export async function patchProduct(
  id: string,
  patch: Record<string, unknown>,
  adminId: string,
) {
  const allowed = [
    'category_id',
    'sku',
    'name_ar',
    'name_en',
    'description',
    'price',
    'is_active',
    'is_bestseller',
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
  const nameEn = patch.name_en as string | undefined;
  const nameAr = patch.name_ar as string | undefined;
  if (nameEn || nameAr) {
    const current = await query<{ name_en: string; name_ar: string }>(
      `SELECT name_en, name_ar FROM products WHERE id = $1`,
      [id],
    );
    if (!current.rows[0]) throw notFound('Product not found');
    const slugs = await makeSlugs(
      'products',
      nameEn ?? current.rows[0].name_en,
      nameAr ?? current.rows[0].name_ar,
      id,
    );
    sets.push(`slug_en = $${i++}`);
    vals.push(slugs.slug_en);
    sets.push(`slug_ar = $${i++}`);
    vals.push(slugs.slug_ar);
  }
  if (sets.length === 0) return getProductDetail(id, false);

  const before = await query(`SELECT * FROM products WHERE id = $1`, [id]);
  if (!before.rows[0]) throw notFound('Product not found');

  vals.push(id);
  const { rows } = await query(
    `UPDATE products SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals,
  );
  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'product.update',
    entityType: 'products',
    entityId: id,
    beforeData: before.rows[0],
    afterData: rows[0],
  });
  return rows[0];
}

export async function deleteProduct(id: string, adminId: string) {
  return withTransaction(async (client) => {
    const { rows: existing } = await client.query(`SELECT * FROM products WHERE id = $1`, [
      id,
    ]);
    if (!existing[0]) throw notFound('Product not found');

    const used = await client.query(
      `SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1`,
      [id],
    );
    if (used.rows[0]) {
      throw conflict(
        'Cannot delete a product that appears on orders. Hide it instead.',
      );
    }

    await client.query(
      `DELETE FROM cart_item_customizations
       WHERE cart_item_id IN (SELECT id FROM cart_items WHERE product_id = $1)`,
      [id],
    );
    await client.query(`DELETE FROM cart_items WHERE product_id = $1`, [id]);
    await client.query(`DELETE FROM products WHERE id = $1`, [id]);

    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'product.delete',
      entityType: 'products',
      entityId: id,
      beforeData: existing[0],
    });
    return existing[0];
  });
}

export async function addProductImage(
  productId: string,
  data: { image_url: string; display_order?: number; is_primary?: boolean },
) {
  await getProductDetail(productId, false);
  if (data.is_primary) {
    await query(
      `UPDATE product_images SET is_primary = FALSE WHERE product_id = $1`,
      [productId],
    );
  }
  const { rows } = await query(
    `INSERT INTO product_images (product_id, image_url, display_order, is_primary)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [productId, data.image_url, data.display_order ?? 0, data.is_primary ?? false],
  );
  return rows[0];
}

export async function upsertVariant(
  productId: string,
  data: {
    variant_type: string;
    value: string;
    price_modifier?: number;
    stock_qty?: number;
    sku_suffix?: string;
    is_active?: boolean;
  },
) {
  await getProductDetail(productId, false);
  const { rows } = await query(
    `INSERT INTO product_variants
      (product_id, variant_type, value, price_modifier, stock_qty, sku_suffix, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (product_id, variant_type, value) DO UPDATE SET
       price_modifier = EXCLUDED.price_modifier,
       stock_qty = EXCLUDED.stock_qty,
       sku_suffix = EXCLUDED.sku_suffix,
       is_active = EXCLUDED.is_active,
       updated_at = NOW()
     RETURNING *`,
    [
      productId,
      data.variant_type,
      data.value,
      data.price_modifier ?? 0,
      data.stock_qty ?? 0,
      data.sku_suffix ?? '',
      data.is_active ?? true,
    ],
  );
  return rows[0];
}

export async function upsertCustomization(
  productId: string,
  data: {
    customization_type: string;
    is_required?: boolean;
    extra_price?: number;
    max_characters?: number | null;
    available_colors?: unknown;
    available_fonts?: unknown;
    is_active?: boolean;
  },
) {
  await getProductDetail(productId, false);
  const { rows } = await query(
    `INSERT INTO product_customizations
      (product_id, customization_type, is_required, extra_price, max_characters,
       available_colors, available_fonts, is_active)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
     ON CONFLICT (product_id, customization_type) DO UPDATE SET
       is_required = EXCLUDED.is_required,
       extra_price = EXCLUDED.extra_price,
       max_characters = EXCLUDED.max_characters,
       available_colors = EXCLUDED.available_colors,
       available_fonts = EXCLUDED.available_fonts,
       is_active = EXCLUDED.is_active,
       updated_at = NOW()
     RETURNING *`,
    [
      productId,
      data.customization_type,
      data.is_required ?? false,
      data.extra_price ?? 0,
      data.max_characters ?? null,
      JSON.stringify(data.available_colors ?? []),
      JSON.stringify(data.available_fonts ?? []),
      data.is_active ?? true,
    ],
  );
  return rows[0];
}
