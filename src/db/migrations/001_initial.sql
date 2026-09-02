-- Cutie Baby — initial schema
-- Postgres via Supabase (no Supabase client libs in app)
-- Syria-first shipping; Gulf zones ready via shipping_zones

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  parent_id     UUID REFERENCES categories(id) ON DELETE RESTRICT,
  display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  image_url     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_active_order ON categories(is_active, display_order);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  sku           TEXT NOT NULL,
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
  avg_rating    NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (avg_rating >= 0 AND avg_rating <= 5),
  review_count  INT NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_products_sku UNIQUE (sku)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_bestseller ON products(is_bestseller) WHERE is_bestseller = TRUE;
CREATE INDEX idx_products_created ON products(created_at DESC);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE product_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images(product_id, display_order);

-- At most one primary image per product
CREATE UNIQUE INDEX uq_product_images_primary
  ON product_images(product_id)
  WHERE is_primary = TRUE;

CREATE TABLE product_variants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_type   TEXT NOT NULL CHECK (variant_type IN ('size', 'color', 'style')),
  value          TEXT NOT NULL,
  price_modifier NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock_qty      INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  sku_suffix     TEXT NOT NULL DEFAULT '',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_product_variant UNIQUE (product_id, variant_type, value)
);

CREATE INDEX idx_product_variants_product ON product_variants(product_id);

CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE product_customizations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customization_type TEXT NOT NULL CHECK (
    customization_type IN ('embroidery_name', 'frame_text', 'pacifier_clip', 'print_design')
  ),
  is_required        BOOLEAN NOT NULL DEFAULT FALSE,
  extra_price        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (extra_price >= 0),
  max_characters     INT CHECK (max_characters IS NULL OR max_characters > 0),
  available_colors   JSONB NOT NULL DEFAULT '[]'::jsonb,
  available_fonts    JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_product_customization UNIQUE (product_id, customization_type)
);

CREATE INDEX idx_product_customizations_product ON product_customizations(product_id);

CREATE TRIGGER trg_product_customizations_updated_at
  BEFORE UPDATE ON product_customizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT,
  password_hash TEXT,
  address       TEXT,
  city          TEXT,
  country       TEXT NOT NULL DEFAULT 'SY',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_customers_phone UNIQUE (phone),
  CONSTRAINT uq_customers_email UNIQUE (email)
);

CREATE INDEX idx_customers_country ON customers(country);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Carts
-- ---------------------------------------------------------------------------
CREATE TABLE carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  session_id  TEXT,
  currency    TEXT NOT NULL DEFAULT 'SYP',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT carts_owner_chk CHECK (customer_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE INDEX idx_carts_customer ON carts(customer_id);
CREATE INDEX idx_carts_session ON carts(session_id);

CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity    INT NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product ON cart_items(product_id);

CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cart_item_customizations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_item_id     UUID NOT NULL REFERENCES cart_items(id) ON DELETE CASCADE,
  customization_id UUID NOT NULL REFERENCES product_customizations(id) ON DELETE RESTRICT,
  custom_text      TEXT,
  chosen_color     TEXT,
  chosen_design    TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cart_item_customization UNIQUE (cart_item_id, customization_id)
);

-- ---------------------------------------------------------------------------
-- Shipping (Syria now, Gulf later)
-- ---------------------------------------------------------------------------
CREATE TABLE shipping_zones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_shipping_zones_code UNIQUE (code)
);

CREATE TRIGGER trg_shipping_zones_updated_at
  BEFORE UPDATE ON shipping_zones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE shipping_rules (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id                UUID NOT NULL REFERENCES shipping_zones(id) ON DELETE RESTRICT,
  shipping_fee           NUMERIC(12, 2) NOT NULL CHECK (shipping_fee >= 0),
  free_shipping_threshold NUMERIC(12, 2) CHECK (
    free_shipping_threshold IS NULL OR free_shipping_threshold >= 0
  ),
  currency               TEXT NOT NULL DEFAULT 'SYP',
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipping_rules_zone ON shipping_rules(zone_id);

-- One active rule per zone+currency
CREATE UNIQUE INDEX uq_shipping_rules_active
  ON shipping_rules(zone_id, currency)
  WHERE is_active = TRUE;

CREATE TRIGGER trg_shipping_rules_updated_at
  BEFORE UPDATE ON shipping_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Offers & coupons
-- ---------------------------------------------------------------------------
CREATE TABLE offers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT offers_date_range_chk CHECK (start_date <= end_date)
);

CREATE INDEX idx_offers_active_dates ON offers(is_active, start_date, end_date);

CREATE TRIGGER trg_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE offer_products (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id   UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  offer_rate NUMERIC(5, 2) NOT NULL CHECK (offer_rate > 0 AND offer_rate <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_offer_product UNIQUE (offer_id, product_id)
);

CREATE INDEX idx_offer_products_product ON offer_products(product_id);

CREATE TABLE coupons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL,
  discount_rate       NUMERIC(5, 2) NOT NULL CHECK (discount_rate > 0 AND discount_rate <= 100),
  min_order_value     NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_order_value >= 0),
  max_uses            INT CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count          INT NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  expires_at          TIMESTAMPTZ,
  applies_to_offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_coupons_code UNIQUE (code),
  CONSTRAINT coupons_uses_chk CHECK (max_uses IS NULL OR uses_count <= max_uses)
);

CREATE INDEX idx_coupons_active ON coupons(is_active, expires_at);

CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders (historical — RESTRICT deletes)
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  order_number     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')
  ),
  payment_method   TEXT NOT NULL CHECK (
    payment_method IN ('cash_on_delivery', 'bank_transfer', 'western_union')
  ),
  subtotal         NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  shipping_cost    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  discount_total   NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  total            NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  currency         TEXT NOT NULL DEFAULT 'SYP',
  shipping_zone_id UUID NOT NULL REFERENCES shipping_zones(id) ON DELETE RESTRICT,
  coupon_id        UUID REFERENCES coupons(id) ON DELETE SET NULL,
  notes            TEXT,
  shipping_address TEXT NOT NULL,
  shipping_city    TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'SY',
  idempotency_key  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_orders_number UNIQUE (order_number)
);

CREATE UNIQUE INDEX uq_orders_idempotency
  ON orders(customer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity    INT NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total  NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
  product_name_ar TEXT NOT NULL,
  product_name_en TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE TABLE order_item_customizations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id    UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  customization_id UUID NOT NULL REFERENCES product_customizations(id) ON DELETE RESTRICT,
  custom_text      TEXT,
  chosen_color     TEXT,
  chosen_design    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_order_item_customization UNIQUE (order_item_id, customization_id)
);

CREATE TABLE coupon_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   UUID NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_coupon_usage_order UNIQUE (order_id),
  CONSTRAINT uq_coupon_usage_once UNIQUE (coupon_id, customer_id, order_id)
);

CREATE INDEX idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_customer ON coupon_usage(customer_id);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  rating        INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  is_approved   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_reviews_order_item UNIQUE (order_item_id),
  CONSTRAINT uq_reviews_customer_product UNIQUE (customer_id, product_id)
);

CREATE INDEX idx_reviews_product ON reviews(product_id, is_approved);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Admin auth
-- ---------------------------------------------------------------------------
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'support')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  failed_logins INT NOT NULL DEFAULT 0 CHECK (failed_logins >= 0),
  locked_until  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_admin_users_email UNIQUE (email)
);

CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  family_id   UUID NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refresh_tokens_subject_chk CHECK (
    (admin_id IS NOT NULL AND customer_id IS NULL)
    OR (admin_id IS NULL AND customer_id IS NOT NULL)
  ),
  CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_tokens_admin ON refresh_tokens(admin_id);
CREATE INDEX idx_refresh_tokens_customer ON refresh_tokens(customer_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);

-- ---------------------------------------------------------------------------
-- Audit log (append-only by convention; app role should not UPDATE/DELETE)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('admin', 'customer', 'system')),
  actor_id    UUID,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  before_data JSONB,
  after_data  JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed shipping: Syria (contract: 1000 SYP + free-shipping threshold)
-- ---------------------------------------------------------------------------
INSERT INTO shipping_zones (name, code, is_active)
VALUES
  ('Syria', 'SY', TRUE),
  ('Gulf', 'GULF', FALSE);

INSERT INTO shipping_rules (zone_id, shipping_fee, free_shipping_threshold, currency, is_active)
SELECT id, 1000, NULL, 'SYP', TRUE
FROM shipping_zones WHERE code = 'SY';
