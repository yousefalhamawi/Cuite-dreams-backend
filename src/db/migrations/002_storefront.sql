-- Storefront connection: bilingual slugs, Cham Cash, receipts, email OTP

-- ---------------------------------------------------------------------------
-- Slugs (English: baby-set  ·  Arabic: طقم-مولود)
-- ---------------------------------------------------------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug_en TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug_ar TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug_ar TEXT;

UPDATE categories SET
  slug_en = trim(both '-' from lower(regexp_replace(coalesce(name_en, ''), '[^a-zA-Z0-9]+', '-', 'g'))),
  slug_ar = trim(both '-' from regexp_replace(coalesce(name_ar, ''), '\s+', '-', 'g'))
WHERE slug_en IS NULL OR slug_ar IS NULL OR slug_en = '' OR slug_ar = '';

UPDATE products SET
  slug_en = trim(both '-' from lower(regexp_replace(coalesce(name_en, ''), '[^a-zA-Z0-9]+', '-', 'g'))),
  slug_ar = trim(both '-' from regexp_replace(coalesce(name_ar, ''), '\s+', '-', 'g'))
WHERE slug_en IS NULL OR slug_ar IS NULL OR slug_en = '' OR slug_ar = '';

-- Empty fallback so NOT NULL succeeds
UPDATE categories SET slug_en = 'category-' || substr(id::text, 1, 8) WHERE slug_en IS NULL OR slug_en = '';
UPDATE categories SET slug_ar = 'قسم-' || substr(id::text, 1, 8) WHERE slug_ar IS NULL OR slug_ar = '';
UPDATE products SET slug_en = 'product-' || substr(id::text, 1, 8) WHERE slug_en IS NULL OR slug_en = '';
UPDATE products SET slug_ar = 'منتج-' || substr(id::text, 1, 8) WHERE slug_ar IS NULL OR slug_ar = '';

-- Deduplicate by appending a short id
UPDATE categories c SET slug_en = c.slug_en || '-' || substr(c.id::text, 1, 8)
WHERE EXISTS (SELECT 1 FROM categories x WHERE x.slug_en = c.slug_en AND x.id < c.id);
UPDATE categories c SET slug_ar = c.slug_ar || '-' || substr(c.id::text, 1, 8)
WHERE EXISTS (SELECT 1 FROM categories x WHERE x.slug_ar = c.slug_ar AND x.id < c.id);
UPDATE products p SET slug_en = p.slug_en || '-' || substr(p.id::text, 1, 8)
WHERE EXISTS (SELECT 1 FROM products x WHERE x.slug_en = p.slug_en AND x.id < p.id);
UPDATE products p SET slug_ar = p.slug_ar || '-' || substr(p.id::text, 1, 8)
WHERE EXISTS (SELECT 1 FROM products x WHERE x.slug_ar = p.slug_ar AND x.id < p.id);

ALTER TABLE categories ALTER COLUMN slug_en SET NOT NULL;
ALTER TABLE categories ALTER COLUMN slug_ar SET NOT NULL;
ALTER TABLE products ALTER COLUMN slug_en SET NOT NULL;
ALTER TABLE products ALTER COLUMN slug_ar SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_slug_en ON categories (slug_en);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_slug_ar ON categories (slug_ar);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_slug_en ON products (slug_en);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_slug_ar ON products (slug_ar);

ALTER TABLE offers ADD COLUMN IF NOT EXISTS slug TEXT;
UPDATE offers SET slug = trim(both '-' from lower(regexp_replace(coalesce(name, ''), '[^a-zA-Z0-9\u0600-\u06FF]+', '-', 'g')))
WHERE slug IS NULL OR slug = '';
UPDATE offers SET slug = 'offer-' || substr(id::text, 1, 8) WHERE slug IS NULL OR slug = '';
UPDATE offers o SET slug = o.slug || '-' || substr(o.id::text, 1, 8)
WHERE EXISTS (SELECT 1 FROM offers x WHERE x.slug = o.slug AND x.id < o.id);
ALTER TABLE offers ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_offers_slug ON offers (slug);

-- ---------------------------------------------------------------------------
-- Cham Cash + payment receipt
-- ---------------------------------------------------------------------------
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cash_on_delivery', 'bank_transfer', 'western_union', 'cham_cash'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_receipt_key TEXT;

-- ---------------------------------------------------------------------------
-- Email OTP for password reset
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  verified_at TIMESTAMPTZ,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON password_reset_otps (email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires ON password_reset_otps (expires_at);
