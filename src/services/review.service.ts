import { query } from '../config/database';
import { badRequest, notFound, forbidden } from '../utils/errors';
import { writeAudit } from './audit.service';

export async function listApprovedReviews(productId: string) {
  const { rows } = await query(
    `SELECT r.id, r.rating, r.comment, r.created_at, c.name AS customer_name
     FROM reviews r
     JOIN customers c ON c.id = r.customer_id
     WHERE r.product_id = $1 AND r.is_approved = TRUE
     ORDER BY r.created_at DESC`,
    [productId],
  );
  return rows;
}

export async function reviewEligibility(customerId: string, productId: string) {
  const reviewed = await query(
    `SELECT 1 FROM reviews WHERE customer_id = $1 AND product_id = $2 LIMIT 1`,
    [customerId, productId],
  );
  if (reviewed.rows[0]) {
    return { eligible: false, already_reviewed: true };
  }

  const owned = await query(
    `SELECT 1
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.customer_id = $1 AND oi.product_id = $2
       AND o.status IN ('paid', 'processing', 'shipped', 'delivered')
     LIMIT 1`,
    [customerId, productId],
  );
  return { eligible: Boolean(owned.rows[0]), already_reviewed: false };
}

export async function createReview(
  customerId: string,
  input: {
    product_id: string;
    order_item_id?: string;
    rating: number;
    comment?: string;
  },
) {
  let orderItemId = input.order_item_id;

  if (orderItemId) {
    const owned = await query<{ id: string; product_id: string }>(
      `SELECT oi.id, oi.product_id
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = $1 AND o.customer_id = $2
         AND o.status IN ('delivered', 'shipped', 'paid', 'processing')`,
      [orderItemId, customerId],
    );
    if (!owned.rows[0]) throw forbidden('Purchase not verified');
    if (owned.rows[0].product_id !== input.product_id) {
      throw badRequest('Order item does not match product');
    }
  } else {
    const owned = await query<{ id: string }>(
      `SELECT oi.id
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN reviews r ON r.order_item_id = oi.id
       WHERE o.customer_id = $1 AND oi.product_id = $2
         AND o.status IN ('delivered', 'shipped', 'paid', 'processing')
         AND r.id IS NULL
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [customerId, input.product_id],
    );
    if (!owned.rows[0]) throw forbidden('Purchase not verified');
    orderItemId = owned.rows[0].id;
  }

  try {
    const { rows } = await query(
      `INSERT INTO reviews (product_id, customer_id, order_item_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.product_id, customerId, orderItemId, input.rating, input.comment ?? null],
    );
    return rows[0];
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw badRequest('You already reviewed this product');
    }
    throw err;
  }
}

export async function listReviewsAdmin(
  status?: 'pending' | 'approved' | 'all',
  paging?: { page?: number; limit?: number },
) {
  const filter = status ?? 'pending';
  const page = Math.max(1, paging?.page ?? 1);
  const limit = Math.min(100, Math.max(1, paging?.limit ?? 20));
  const offset = (page - 1) * limit;
  const where =
    filter === 'approved'
      ? 'WHERE r.is_approved = TRUE'
      : filter === 'all'
        ? ''
        : 'WHERE r.is_approved = FALSE';

  const count = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM reviews r ${where}`,
  );
  const { rows } = await query(
    `SELECT r.*, c.name AS customer_name, p.name_ar AS product_name,
            p.slug_ar, p.slug_en
     FROM reviews r
     JOIN customers c ON c.id = r.customer_id
     JOIN products p ON p.id = r.product_id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const total = Number(count.rows[0].count);
  return { items: rows, page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
}

export async function moderateReview(
  reviewId: string,
  approve: boolean,
  adminId: string,
) {
  if (!approve) {
    const deleted = await query(
      `DELETE FROM reviews WHERE id = $1 RETURNING *`,
      [reviewId],
    );
    if (!deleted.rows[0]) throw notFound('Review not found');
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'review.reject',
      entityType: 'reviews',
      entityId: reviewId,
      beforeData: deleted.rows[0],
    });
    return { rejected: true };
  }

  const { rows } = await query(
    `UPDATE reviews SET is_approved = TRUE WHERE id = $1 RETURNING *`,
    [reviewId],
  );
  if (!rows[0]) throw notFound('Review not found');

  await refreshProductRating(rows[0].product_id as string);

  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'review.approve',
    entityType: 'reviews',
    entityId: reviewId,
    afterData: rows[0],
  });
  return rows[0];
}

export async function deleteReview(reviewId: string, adminId: string) {
  const { rows } = await query(`DELETE FROM reviews WHERE id = $1 RETURNING *`, [reviewId]);
  if (!rows[0]) throw notFound('Review not found');

  await refreshProductRating(rows[0].product_id as string);

  await writeAudit({
    actorType: 'admin',
    actorId: adminId,
    action: 'review.delete',
    entityType: 'reviews',
    entityId: reviewId,
    beforeData: rows[0],
  });
  return rows[0];
}

async function refreshProductRating(productId: string): Promise<void> {
  await query(
    `UPDATE products SET
       avg_rating = COALESCE((
         SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews
         WHERE product_id = $1 AND is_approved = TRUE
       ), 0),
       review_count = (
         SELECT COUNT(*)::int FROM reviews
         WHERE product_id = $1 AND is_approved = TRUE
       )
     WHERE id = $1`,
    [productId],
  );
}
