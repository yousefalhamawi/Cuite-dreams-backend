ALTER TABLE shipping_zones
  ADD COLUMN IF NOT EXISTS neighborhoods TEXT[] NOT NULL DEFAULT '{}';
