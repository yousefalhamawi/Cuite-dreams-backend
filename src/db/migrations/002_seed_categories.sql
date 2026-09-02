-- Seed the 7 store sections from the client contract (AR / EN)
-- Runs once via schema_migrations
INSERT INTO categories (name_ar, name_en, display_order, is_active) VALUES
  ('الأكياس والتغليف والمناديل', 'Bags, Packaging & Tissues', 1, TRUE),
  ('أطقم الأم للاستقبال والمباركة', 'Mom Reception & Blessing Sets', 2, TRUE),
  ('التطريز حسب الطلب', 'Custom Embroidery', 3, TRUE),
  ('التوزيعات والهدايا', 'Gifts & Distributions', 4, TRUE),
  ('مستلزمات المولود الجديد', 'Newborn Essentials', 5, TRUE),
  ('العناية بالطفل', 'Baby Care', 6, TRUE),
  ('البروش', 'Brooches', 7, TRUE);
