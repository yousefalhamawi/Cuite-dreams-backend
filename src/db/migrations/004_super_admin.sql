-- One admin role. One delivery zone on the customer (gift-shop profile, not an address book).

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
UPDATE admin_users SET role = 'super_admin';
ALTER TABLE admin_users ALTER COLUMN role SET DEFAULT 'super_admin';
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK (role = 'super_admin');

ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_zone_id UUID REFERENCES shipping_zones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_customers_shipping_zone ON customers(shipping_zone_id);
