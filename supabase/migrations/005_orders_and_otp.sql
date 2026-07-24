-- ============================================================
-- MIGRATION 005: Orders, Order Items & OTP Logs
-- Depends on: 002, 003, 004
-- This is the heart of the transaction system.
-- ============================================================

-- ─────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Human-readable order number (e.g., AG-2026-00001)
  -- Generated via trigger below
  order_number        VARCHAR(30) NOT NULL UNIQUE,

  -- Parties
  salesperson_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  manager_id          UUID REFERENCES users(id) ON DELETE SET NULL,  -- Manager at time of order

  -- Lifecycle
  status              order_status NOT NULL DEFAULT 'draft',

  -- Pricing snapshot (locked at order confirmation; prices may change later)
  subtotal            NUMERIC(12, 2) NOT NULL DEFAULT 0,   -- Sum of line_totals before GST
  total_gst           NUMERIC(12, 2) NOT NULL DEFAULT 0,   -- Total GST amount
  discount_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,   -- Scheme + manual discounts
  grand_total         NUMERIC(12, 2) NOT NULL DEFAULT 0,   -- Final payable amount

  -- Discount approval (for salesperson-requested extra discounts)
  extra_discount_requested  NUMERIC(12, 2),                -- Salesperson asked for this
  extra_discount_approved   NUMERIC(12, 2),                -- Manager approved this
  extra_discount_reason     TEXT,
  approved_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at               TIMESTAMPTZ,

  -- Delivery details
  delivery_address    JSONB NOT NULL DEFAULT '{}',          -- Snapshot of client address at order time
  delivery_date       DATE,                                 -- Requested delivery date
  payment_terms       payment_terms NOT NULL DEFAULT 'cash',
  notes               TEXT,                                 -- Salesperson's note to warehouse

  -- OTP verification
  otp_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  otp_verified_at     TIMESTAMPTZ,
  otp_sent_to         VARCHAR(15),                          -- Mobile number OTP was sent to

  -- Offline sync tracking
  local_draft_id      VARCHAR(100),                         -- WatermelonDB local ID (for dedup)
  created_offline     BOOLEAN NOT NULL DEFAULT FALSE,       -- Was this order created offline?

  -- Lifecycle timestamps
  placed_at           TIMESTAMPTZ,                          -- When OTP confirmed
  confirmed_at        TIMESTAMPTZ,                          -- When warehouse accepted
  picking_started_at  TIMESTAMPTZ,
  packed_at           TIMESTAMPTZ,
  dispatched_at       TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,
  cancelled_by        UUID REFERENCES users(id) ON DELETE SET NULL,

  -- PDF export
  pdf_url             TEXT,                                  -- Cloudinary URL of generated PDF

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- AUTO ORDER NUMBER GENERATOR
-- Format: AG-YYYY-NNNNN (e.g., AG-2026-00001)
-- Uses a sequence per year for predictable numbering
-- ─────────────────────────────────────────
CREATE SEQUENCE order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if not already set (supports manual override in tests)
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'AG-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                        LPAD(NEXTVAL('order_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Indexes for order queries
CREATE INDEX idx_orders_salesperson_id   ON orders(salesperson_id);
CREATE INDEX idx_orders_client_id        ON orders(client_id);
CREATE INDEX idx_orders_status           ON orders(status);
CREATE INDEX idx_orders_created_at       ON orders(created_at DESC);
CREATE INDEX idx_orders_placed_at        ON orders(placed_at DESC) WHERE placed_at IS NOT NULL;
CREATE INDEX idx_orders_order_number     ON orders(order_number);
-- Composite index for manager dashboard queries (salesperson + date range)
CREATE INDEX idx_orders_sp_date          ON orders(salesperson_id, created_at DESC);
-- Warehouse queue index (status + dispatched date)
CREATE INDEX idx_orders_warehouse_queue  ON orders(status, delivery_date ASC)
  WHERE status IN ('confirmed', 'picking', 'packed');

-- ─────────────────────────────────────────
-- ORDER ITEMS
-- Line items within an order
-- Prices are SNAPSHOTTED at order time — do not reference live product prices
-- ─────────────────────────────────────────
CREATE TABLE order_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  -- Product snapshot (name/SKU stored to survive catalogue changes)
  product_name        VARCHAR(255) NOT NULL,
  sku_code            VARCHAR(100) NOT NULL,

  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  unit                VARCHAR(30) NOT NULL,
  unit_price          NUMERIC(10, 2) NOT NULL,             -- Price per unit (ex-GST)
  gst_percent         NUMERIC(5, 2) NOT NULL DEFAULT 0,
  gst_amount          NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- GST for this line item
  discount_amount     NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- Scheme discount on this line
  line_total          NUMERIC(12, 2) NOT NULL,             -- (unit_price × qty) + gst - discount

  -- Which scheme was applied (if any)
  scheme_id           UUID REFERENCES schemes(id) ON DELETE SET NULL,
  scheme_name         VARCHAR(200),                        -- Snapshot of scheme name
  free_qty            INTEGER NOT NULL DEFAULT 0,          -- Free items from scheme

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- ─────────────────────────────────────────
-- OTP LOGS
-- Immutable audit trail for all OTP events
-- Per PRD: no deletes allowed; bcrypt-hashed OTP stored in Redis (not here)
-- This table records the EVENTS, not the OTP value itself
-- ─────────────────────────────────────────
CREATE TABLE otp_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  salesperson_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,

  -- Contact details at time of OTP send
  mobile_sent_to  VARCHAR(15) NOT NULL,
  channel         VARCHAR(10) NOT NULL DEFAULT 'sms'       -- 'sms' | 'whatsapp'
                    CHECK (channel IN ('sms', 'whatsapp')),

  -- Timing
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,                    -- sent_at + 10 minutes
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ,

  -- Attempt tracking (max 3 attempts per OTP)
  attempt_count   SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 3,

  -- Device & geolocation audit (captured from salesperson's device)
  device_id       VARCHAR(255),
  ip_address      INET,
  geo_lat         NUMERIC(10, 7),
  geo_lng         NUMERIC(10, 7),

  -- Result
  failure_reason  VARCHAR(100)                             -- 'expired', 'max_attempts', 'invalid'
);

-- OTP logs are INSERT-only (no updates/deletes in application code)
-- Indexes for lookup performance
CREATE INDEX idx_otp_logs_order_id       ON otp_logs(order_id);
CREATE INDEX idx_otp_logs_mobile_sent_to ON otp_logs(mobile_sent_to);
CREATE INDEX idx_otp_logs_sent_at        ON otp_logs(sent_at DESC);

-- ─────────────────────────────────────────
-- ORDER STATUS HISTORY
-- Full audit trail of every status change with actor
-- ─────────────────────────────────────────
CREATE TABLE order_status_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  from_status order_status,
  to_status   order_status NOT NULL,
  notes       TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);

-- ─────────────────────────────────────────
-- TRIGGER: Auto-log status changes on orders
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, from_status, to_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_order_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- ─────────────────────────────────────────
-- TRIGGER: Keep client stats up to date
-- Updates clients.total_orders, total_revenue, last_order_at
-- when an order is placed (status → 'placed')
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_client_stats_on_order()
RETURNS TRIGGER AS $$
BEGIN
  -- When an order moves to 'placed' status, increment client counters
  IF NEW.status = 'placed' AND (OLD.status IS DISTINCT FROM 'placed') THEN
    UPDATE clients
    SET
      total_orders   = total_orders + 1,
      total_revenue  = total_revenue + NEW.grand_total,
      last_order_at  = NOW()
    WHERE id = NEW.client_id;
  END IF;

  -- If order is cancelled after being placed, decrement
  IF NEW.status = 'cancelled' AND OLD.status = 'placed' THEN
    UPDATE clients
    SET
      total_orders  = GREATEST(total_orders - 1, 0),
      total_revenue = GREATEST(total_revenue - NEW.grand_total, 0)
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_client_stats
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_client_stats_on_order();
