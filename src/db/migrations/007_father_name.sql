ALTER TABLE cart_item_customizations
  ADD COLUMN father_name TEXT;

ALTER TABLE order_item_customizations
  ADD COLUMN father_name TEXT,
  ADD COLUMN notes TEXT;
