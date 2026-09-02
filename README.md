# Cutie Baby API

Node.js + Express + TypeScript backend for a bilingual (AR/EN) newborn e-commerce store.
**Syria-first shipping**, Gulf zones ready. Uses **Supabase Postgres via `pg` only** — no Supabase client libraries, no Redis.

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js + Express 5 + TypeScript (`tsx`) |
| DB | PostgreSQL (Supabase) through `pg` connection pool |
| Auth | JWT (separate admin/customer secrets + audiences) + hashed refresh tokens |
| Validation | Zod |
| Docs | Swagger UI at `/api/docs` |
| Rate limit | In-memory (`express-rate-limit`) — single instance |

## Quick start

```bash
cd backend
cp .env.example .env
# set DATABASE_URL + JWT secrets (min 32 chars)

npm install
npm run migrate
npm run seed:admin
npm run dev
```

- API base: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/api/docs`

## Structure

```
src/
  config/          env + Postgres pool
  db/migrations/   SQL schema (constraints, indexes, seeds)
  middlewares/     auth, validate, rateLimit, security, errors
  controllers/     thin HTTP adapters
  services/        business logic + SQL
  routes/          route wiring
  validators/      Zod schemas (whitelisted bodies)
  swagger/         OpenAPI
  utils/           tokens, password, response shape
```

## Contract features covered

1. Catalog sections via `categories` (bags, mom sets, embroidery, gifts, newborn, baby care, brooches)
2. Bestsellers via `products.is_bestseller`
3. Variants: size / color / style (royal · classic · normal)
4. Customizations: embroidery name, frame text, pacifier clip, print design
5. Shipping: Syria zone @ **1000 SYP** + optional free-shipping threshold; **Gulf** zone pre-seeded inactive
6. Payments: `cash_on_delivery` | `bank_transfer` | `western_union`
7. Offers + coupons
8. Verified-purchase reviews (moderated)
9. Admin panel APIs for catalog, orders, shipping, offers, reviews

## Security (applied for this project)

- DB `CHECK` constraints on money, ratings, date ranges, enums
- Soft-deactivate catalog (`is_active`) instead of hard deletes on history
- FK `ON DELETE RESTRICT` on orders / financial rows
- Passwords: bcrypt (12 rounds)
- Refresh tokens: SHA-256 hashed, rotated, family revocation on reuse
- Admin lockout after 5 failed logins (IP rate limit + account lock)
- Separate JWT audiences for admin vs customer
- Ownership checks in SQL (`WHERE id AND customer_id`) → **404** not 403
- Explicit PATCH field whitelists (no mass assignment)
- Audit log on admin mutations
- Tiered rate limits + `Retry-After` on 429
- Checkout `Idempotency-Key` scoped to customer
- Guest checkout never overwrites password-backed customer rows

## Main endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/admin/login` | Admin |
| POST | `/auth/customer/register` | Customer |
| GET | `/catalog/categories` | Public |
| GET | `/catalog/products?bestseller=true` | Public |
| GET | `/catalog/products/:id` | + variants + customizations |
| POST | `/cart/items` | `X-Session-Id` or customer JWT |
| POST | `/orders/checkout` | Idempotency-Key header |
| GET | `/shipping/zones` | Syria + Gulf |
| GET | `/offers` | Active deals |
| POST | `/reviews` | Customer + verified order item |
| PATCH | `/orders/admin/:id/status` | Admin |

## Env

See `.env.example`. Never commit `.env`.
