-- ============================================================
-- MIGRATION 004: Product Catalogue Tables
-- Depends on: 001_enums_and_extensions.sql
-- ============================================================

-- ─────────────────────────────────────────
-- CATEGORIES
-- Hierarchical product categories (supports parent → child nesting)
-- e.g., "Beverages" → "Soft Drinks" → "Cola"
-- ─────────────────────────────────────────
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(150) NOT NULL,
  slug        VARCHAR(150) NOT NULL UNIQUE,           -- URL-friendly, e.g., "soft-drinks"
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,  -- NULL = top-level
  image_url   TEXT,                                   -- Category banner image (Cloudinary)
  sort_order  SMALLINT NOT NULL DEFAULT 0,            -- Display ordering
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_parent_id  ON categories(parent_id);
CREATE INDEX idx_categories_slug       ON categories(slug);
CREATE INDEX idx_categories_sort_order ON categories(sort_order) WHERE is_active = TRUE;

CREATE TRIGGER set_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────
-- BRANDS
-- ─────────────────────────────────────────
CREATE TABLE brands (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(150) NOT NULL UNIQUE,
  logo_url    TEXT,                                   -- Cloudinary URL
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SCHEMES (Promotional Schemes)
-- Configured by admin; linked to products
-- Evaluated at cart time by pricing engine
-- ─────────────────────────────────────────
CREATE TABLE schemes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  scheme_type     scheme_type NOT NULL,

  -- Date window: NULL = open-ended
  valid_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until     DATE,

  -- Applicable scope — at least one must be set
  -- If product_id is set, scheme applies to that product only
  -- If category_id is set, scheme applies to all products in that category
  product_id      UUID,                   -- FK added after products table creation (see below)
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Quantity-based: buy X get Y free
  buy_quantity    INTEGER,                -- Trigger quantity
  free_quantity   INTEGER,               -- Free items given

  -- Value-based: spend ₹Z get N% off
  min_order_value NUMERIC(12, 2),        -- Minimum cart value to activate
  discount_percent NUMERIC(5, 2),        -- % discount on qualifying items
  discount_flat   NUMERIC(10, 2),        -- Flat ₹ discount on qualifying items

  -- Applicable price tiers (NULL = applies to all)
  applicable_tiers price_tier[],

  -- Visibility ribbon text on product card (e.g., "Buy 10 Get 1 Free")
  ribbon_text     VARCHAR(100),

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schemes_product_id    ON schemes(product_id) WHERE is_active = TRUE;
CREATE INDEX idx_schemes_category_id   ON schemes(category_id) WHERE is_active = TRUE;
CREATE INDEX idx_schemes_valid_until   ON schemes(valid_until) WHERE valid_until IS NOT NULL AND is_active = TRUE;

CREATE TRIGGER set_schemes_updated_at
  BEFORE UPDATE ON schemes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────
-- PRODUCTS
-- Core product catalogue
-- ─────────────────────────────────────────
CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(255) NOT NULL,
  sku_code            VARCHAR(100) NOT NULL UNIQUE,    -- Internal stock-keeping unit
  barcode             VARCHAR(100) UNIQUE,             -- EAN/UPC barcode for scanning

  -- Classification
  category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand_id            UUID REFERENCES brands(id) ON DELETE SET NULL,

  -- Description & media
  description         TEXT,
  images              TEXT[] NOT NULL DEFAULT '{}',   -- Array of Cloudinary URLs

  -- Packaging
  pack_size           VARCHAR(50),                    -- e.g., "500ml", "1kg", "Pack of 12"
  unit                VARCHAR(30) NOT NULL DEFAULT 'piece',  -- piece, kg, litre, box, etc.

  -- Pricing (all prices are EXCLUSIVE of GST)
  mrp                 NUMERIC(10, 2) NOT NULL,         -- Maximum retail price
  retailer_price      NUMERIC(10, 2) NOT NULL,
  distributor_price   NUMERIC(10, 2),
  wholesale_price     NUMERIC(10, 2),
  vip_price           NUMERIC(10, 2),
  gst_percent         NUMERIC(5, 2) NOT NULL DEFAULT 0, -- GST rate: 0, 5, 12, 18, 28

  -- Inventory
  stock_qty           INTEGER NOT NULL DEFAULT 0,
  reserved_qty        INTEGER NOT NULL DEFAULT 0,     -- Qty reserved in pending orders
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,    -- Triggers alert when stock_qty ≤ this
  allow_backorder     BOOLEAN NOT NULL DEFAULT FALSE, -- Can order even if out of stock?

  -- Active scheme (nullable; FK to schemes)
  scheme_id           UUID REFERENCES schemes(id) ON DELETE SET NULL,

  -- Lifecycle
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at          TIMESTAMPTZ,

  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Now add the FK from schemes.product_id → products.id
ALTER TABLE schemes ADD CONSTRAINT fk_schemes_product_id
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- Performance indexes
CREATE INDEX idx_products_category_id   ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_brand_id      ON products(brand_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_sku_code      ON products(sku_code);
CREATE INDEX idx_products_barcode       ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_stock_qty     ON products(stock_qty) WHERE is_active = TRUE;
CREATE INDEX idx_products_low_stock     ON products(stock_qty) WHERE stock_qty <= low_stock_threshold AND is_active = TRUE;

-- Full-text search index on name + description
CREATE INDEX idx_products_search ON products
  USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────
-- PRODUCT PRICE HISTORY
-- Audit trail for price changes (admin accountability)
-- ─────────────────────────────────────────
CREATE TABLE product_price_history (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  changed_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  mrp_old             NUMERIC(10, 2),
  mrp_new             NUMERIC(10, 2),
  retailer_price_old  NUMERIC(10, 2),
  retailer_price_new  NUMERIC(10, 2),
  distributor_price_old NUMERIC(10, 2),
  distributor_price_new NUMERIC(10, 2),
  wholesale_price_old NUMERIC(10, 2),
  wholesale_price_new NUMERIC(10, 2),
  vip_price_old       NUMERIC(10, 2),
  vip_price_new       NUMERIC(10, 2),
  gst_percent_old     NUMERIC(5, 2),
  gst_percent_new     NUMERIC(5, 2),
  change_reason       TEXT,
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_history_product_id ON product_price_history(product_id);
CREATE INDEX idx_price_history_changed_at  ON product_price_history(changed_at DESC);
