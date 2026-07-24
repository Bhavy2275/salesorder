-- ============================================================
-- MIGRATION 009: Seed Data
-- Development and staging seed data
-- DO NOT run in production — use separate production seed if needed
-- ============================================================

-- ─────────────────────────────────────────
-- TERRITORIES
-- ─────────────────────────────────────────
INSERT INTO territories (id, name, description, state, city) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Mumbai North',  'Andheri, Goregaon, Malad, Borivali',     'Maharashtra', 'Mumbai'),
  ('a1000000-0000-0000-0000-000000000002', 'Mumbai South',  'Bandra, Worli, Dadar, Lower Parel',      'Maharashtra', 'Mumbai'),
  ('a1000000-0000-0000-0000-000000000003', 'Pune Central',  'Shivajinagar, Kothrud, Hadapsar',        'Maharashtra', 'Pune'),
  ('a1000000-0000-0000-0000-000000000004', 'Delhi NCR',     'Gurugram, Noida, Faridabad, Ghaziabad',  'Delhi',       'Delhi'),
  ('a1000000-0000-0000-0000-000000000005', 'Bengaluru East','Whitefield, Marathahalli, Indiranagar',  'Karnataka',   'Bengaluru');

-- ─────────────────────────────────────────
-- USERS (passwords: "Password@123" — bcrypt hash below)
-- In production, never seed real user passwords
-- ─────────────────────────────────────────

-- bcrypt hash for "Password@123" (cost 10)
-- $2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
-- Use the actual hash from your bcrypt utility when seeding

INSERT INTO users (id, name, mobile, email, password_hash, role, territory_id, employee_code) VALUES
  -- Admin
  ('b1000000-0000-0000-0000-000000000001',
   'Arjun Sharma',    '9999000001', 'admin@antigravity.in',
   '$2b$10$PLACEHOLDER_HASH_REPLACE_IN_PRODUCTION',
   'admin', NULL, 'AG-ADMIN-001'),

  -- Managers
  ('b1000000-0000-0000-0000-000000000002',
   'Priya Menon',     '9999000002', 'priya.m@antigravity.in',
   '$2b$10$PLACEHOLDER_HASH_REPLACE_IN_PRODUCTION',
   'manager', 'a1000000-0000-0000-0000-000000000001', 'AG-MGR-001'),

  ('b1000000-0000-0000-0000-000000000003',
   'Rahul Joshi',     '9999000003', 'rahul.j@antigravity.in',
   '$2b$10$PLACEHOLDER_HASH_REPLACE_IN_PRODUCTION',
   'manager', 'a1000000-0000-0000-0000-000000000004', 'AG-MGR-002'),

  -- Salespersons (reporting to Priya)
  ('b1000000-0000-0000-0000-000000000004',
   'Amit Verma',      '9999000004', 'amit.v@antigravity.in',
   '$2b$10$PLACEHOLDER_HASH_REPLACE_IN_PRODUCTION',
   'salesperson', 'a1000000-0000-0000-0000-000000000001', 'AG-SP-001'),

  ('b1000000-0000-0000-0000-000000000005',
   'Sneha Patil',     '9999000005', 'sneha.p@antigravity.in',
   '$2b$10$PLACEHOLDER_HASH_REPLACE_IN_PRODUCTION',
   'salesperson', 'a1000000-0000-0000-0000-000000000002', 'AG-SP-002'),

  -- Salesperson reporting to Rahul
  ('b1000000-0000-0000-0000-000000000006',
   'Karan Kapoor',    '9999000006', 'karan.k@antigravity.in',
   '$2b$10$PLACEHOLDER_HASH_REPLACE_IN_PRODUCTION',
   'salesperson', 'a1000000-0000-0000-0000-000000000004', 'AG-SP-003'),

  -- Warehouse staff
  ('b1000000-0000-0000-0000-000000000007',
   'Ravi Kumar',      '9999000007', 'ravi.wh@antigravity.in',
   '$2b$10$PLACEHOLDER_HASH_REPLACE_IN_PRODUCTION',
   'warehouse', NULL, 'AG-WH-001');

-- Set manager_id for salespersons
UPDATE users SET manager_id = 'b1000000-0000-0000-0000-000000000002'
  WHERE id IN ('b1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000005');

UPDATE users SET manager_id = 'b1000000-0000-0000-0000-000000000003'
  WHERE id = 'b1000000-0000-0000-0000-000000000006';

-- ─────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────
INSERT INTO categories (id, name, slug, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Beverages',       'beverages',       1),
  ('c1000000-0000-0000-0000-000000000002', 'Snacks & Namkeen','snacks-namkeen',  2),
  ('c1000000-0000-0000-0000-000000000003', 'Personal Care',   'personal-care',   3),
  ('c1000000-0000-0000-0000-000000000004', 'Home Care',       'home-care',       4),
  ('c1000000-0000-0000-0000-000000000005', 'Dairy & Chilled', 'dairy-chilled',   5),
  ('c1000000-0000-0000-0000-000000000006', 'Staples & Grains','staples-grains',  6);

-- Sub-categories
INSERT INTO categories (id, name, slug, parent_id, sort_order) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'Soft Drinks',    'soft-drinks',    'c1000000-0000-0000-0000-000000000001', 1),
  ('c2000000-0000-0000-0000-000000000002', 'Juices',         'juices',         'c1000000-0000-0000-0000-000000000001', 2),
  ('c2000000-0000-0000-0000-000000000003', 'Energy Drinks',  'energy-drinks',  'c1000000-0000-0000-0000-000000000001', 3),
  ('c2000000-0000-0000-0000-000000000004', 'Chips & Crisps', 'chips-crisps',   'c1000000-0000-0000-0000-000000000002', 1),
  ('c2000000-0000-0000-0000-000000000005', 'Biscuits',       'biscuits',       'c1000000-0000-0000-0000-000000000002', 2);

-- ─────────────────────────────────────────
-- BRANDS
-- ─────────────────────────────────────────
INSERT INTO brands (id, name) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'CoolSip'),
  ('d1000000-0000-0000-0000-000000000002', 'SnapCrunch'),
  ('d1000000-0000-0000-0000-000000000003', 'FreshFarm'),
  ('d1000000-0000-0000-0000-000000000004', 'CleanHouse'),
  ('d1000000-0000-0000-0000-000000000005', 'BrightCare');

-- ─────────────────────────────────────────
-- PRODUCTS (sample catalogue)
-- ─────────────────────────────────────────
INSERT INTO products (
  id, name, sku_code, category_id, brand_id,
  description, pack_size, unit,
  mrp, retailer_price, distributor_price, wholesale_price, vip_price,
  gst_percent, stock_qty, low_stock_threshold
) VALUES
  (
    'e1000000-0000-0000-0000-000000000001',
    'CoolSip Cola 600ml', 'CS-COLA-600',
    'c2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
    'Refreshing cola beverage — 600ml PET bottle', '600ml', 'bottle',
    40.00, 32.00, 29.00, 27.00, 25.00,
    12, 500, 50
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'CoolSip Cola 2L',   'CS-COLA-2L',
    'c2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
    'Refreshing cola beverage — 2L PET bottle', '2L', 'bottle',
    95.00, 78.00, 72.00, 68.00, 64.00,
    12, 300, 30
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'SnapCrunch Masala Chips 50g', 'SC-CHIPS-50',
    'c2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002',
    'Spicy masala flavour chips — 50g pack', '50g', 'packet',
    20.00, 15.00, 13.50, 12.00, 11.00,
    18, 1200, 100
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'SnapCrunch Masala Chips 130g', 'SC-CHIPS-130',
    'c2000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002',
    'Spicy masala flavour chips — 130g pack', '130g', 'packet',
    45.00, 36.00, 33.00, 30.00, 28.00,
    18, 800, 80
  ),
  (
    'e1000000-0000-0000-0000-000000000005',
    'FreshFarm Mango Juice 1L', 'FF-JUICE-MANGO-1L',
    'c2000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003',
    '100% natural mango juice — 1L Tetra Pack', '1L', 'pack',
    70.00, 58.00, 54.00, 50.00, 47.00,
    12, 400, 40
  );

-- ─────────────────────────────────────────
-- SCHEMES
-- ─────────────────────────────────────────
INSERT INTO schemes (
  id, name, description, scheme_type,
  valid_from, valid_until,
  product_id, buy_quantity, free_quantity,
  ribbon_text, is_active, created_by
) VALUES
  (
    'f1000000-0000-0000-0000-000000000001',
    'Cola 10+1 Summer Scheme',
    'Buy 10 bottles of CoolSip Cola 600ml, get 1 free',
    'quantity_based',
    '2026-04-01', '2026-07-31',
    'e1000000-0000-0000-0000-000000000001',
    10, 1,
    'Buy 10 Get 1 Free 🎉',
    TRUE, 'b1000000-0000-0000-0000-000000000001'
  );

-- Link scheme to product
UPDATE products SET scheme_id = 'f1000000-0000-0000-0000-000000000001'
  WHERE id = 'e1000000-0000-0000-0000-000000000001';

-- ─────────────────────────────────────────
-- SAMPLE CLIENTS (assigned to Amit Verma)
-- ─────────────────────────────────────────
INSERT INTO clients (
  id, business_name, contact_person, mobile_primary,
  email, business_type, billing_address, delivery_address,
  geo_lat, geo_lng,
  assigned_salesperson_id, territory_id,
  price_tier, credit_limit, payment_terms
) VALUES
  (
    'g1000000-0000-0000-0000-000000000001',
    'Sharma General Store', 'Deepak Sharma', '9876543210',
    'sharma.store@gmail.com', 'retailer',
    '{"line1": "Shop 5, Lokhandwala Market", "city": "Mumbai", "state": "Maharashtra", "pincode": "400053"}',
    '{"line1": "Shop 5, Lokhandwala Market", "city": "Mumbai", "state": "Maharashtra", "pincode": "400053"}',
    19.136390, 72.825256,
    'b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001',
    'retailer', 10000.00, 'net_7'
  ),
  (
    'g1000000-0000-0000-0000-000000000002',
    'Patel Distributors Pvt Ltd', 'Manish Patel', '9876543211',
    'patel.dist@gmail.com', 'distributor',
    '{"line1": "Warehouse 12, MIDC Industrial Area", "city": "Mumbai", "state": "Maharashtra", "pincode": "400093"}',
    '{"line1": "Warehouse 12, MIDC Industrial Area", "city": "Mumbai", "state": "Maharashtra", "pincode": "400093"}',
    19.073790, 72.879654,
    'b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001',
    'distributor', 50000.00, 'net_15'
  );

-- Tag the clients
INSERT INTO client_tags (client_id, tag_id, tagged_by) VALUES
  (
    'g1000000-0000-0000-0000-000000000001',
    (SELECT id FROM client_tag_definitions WHERE name = 'Hot Lead'),
    'b1000000-0000-0000-0000-000000000004'
  ),
  (
    'g1000000-0000-0000-0000-000000000002',
    (SELECT id FROM client_tag_definitions WHERE name = 'VIP'),
    'b1000000-0000-0000-0000-000000000004'
  );
