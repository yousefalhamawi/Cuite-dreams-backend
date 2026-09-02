-- Keep the chosen gift wrap on the order, not only on the cart
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS packaging_id TEXT;
