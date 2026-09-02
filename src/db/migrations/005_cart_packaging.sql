-- Gift wrap choice on cart lines (عادي / كلاسيكي / ملكي)
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS packaging_id TEXT;
