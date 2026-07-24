-- ============================================================
-- MIGRATION 003: Client Management Tables
-- Depends on: 002_users_and_territories.sql
-- ============================================================

-- ─────────────────────────────────────────
-- CLIENTS
-- Businesses the salesperson sells to
-- ─────────────────────────────────────────
CREATE TABLE clients (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Business identity
  business_name           VARCHAR(255) NOT NULL,
  contact_person          VARCHAR(200) NOT NULL,
  mobile_primary          VARCHAR(15) NOT NULL,           -- OTP will be sent here
  mobile_secondary        VARCHAR(15),
  whatsapp_number         VARCHAR(15),                    -- May differ from mobile
  email                   VARCHAR(255),

  -- Tax / Legal
  gst_number              VARCHAR(20),                    -- GST registration number
  pan_number              VARCHAR(15),                    -- PAN card number (encrypted)
  business_type           business_type NOT NULL DEFAULT 'retailer',

  -- Addresses (stored as structured JSON for flexibility)
  -- Shape: { line1, line2, city, state, pincode, landmark }
  billing_address         JSONB NOT NULL DEFAULT '{}',
  delivery_address        JSONB NOT NULL DEFAULT '{}',    -- Can differ from billing

  -- Geolocation (delivery destination pin)
  geo_lat                 NUMERIC(10, 7),
  geo_lng                 NUMERIC(10, 7),
  geo_accuracy            NUMERIC(6, 2),                  -- Meters; helps assess GPS quality

  -- Assignment & territory
  assigned_salesperson_id UUID REFERENCES users(id) ON DELETE SET NULL,
  territory_id            UUID REFERENCES territories(id) ON DELETE SET NULL,

  -- Commercial terms
  price_tier              price_tier NOT NULL DEFAULT 'retailer',
  credit_limit            NUMERIC(12, 2) NOT NULL DEFAULT 0,   -- ₹ credit extended
  payment_terms           payment_terms NOT NULL DEFAULT 'cash',
  outstanding_balance     NUMERIC(12, 2) NOT NULL DEFAULT 0,   -- Current unpaid amount

  -- Profile
  client_photo_url        TEXT,                           -- Cloudinary URL (shop front)
  notes                   TEXT,                           -- Internal salesperson notes

  -- Lifecycle tracking
  last_order_at           TIMESTAMPTZ,
  last_visited_at         TIMESTAMPTZ,                    -- When salesperson last checked in
  total_orders            INTEGER NOT NULL DEFAULT 0,
  total_revenue           NUMERIC(14, 2) NOT NULL DEFAULT 0,

  -- Soft delete
  deleted_at              TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common search patterns
CREATE INDEX idx_clients_salesperson     ON clients(assigned_salesperson_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_territory       ON clients(territory_id);
CREATE INDEX idx_clients_business_name   ON clients USING GIN (to_tsvector('english', business_name));
CREATE INDEX idx_clients_mobile_primary  ON clients(mobile_primary);
CREATE INDEX idx_clients_gst             ON clients(gst_number) WHERE gst_number IS NOT NULL;
CREATE INDEX idx_clients_last_order_at   ON clients(last_order_at DESC);

CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────
-- CLIENT TAG DEFINITIONS
-- Reusable tag library: "Hot Lead", "VIP", "Lapsed", custom tags
-- ─────────────────────────────────────────
CREATE TABLE client_tag_definitions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL UNIQUE,   -- e.g., "Hot Lead", "VIP"
  color       VARCHAR(7),                     -- Hex color for UI badge, e.g., "#FF5733"
  icon        VARCHAR(50),                    -- Optional icon slug (for mobile rendering)
  is_system   BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = cannot be deleted by users
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the system tags (manager/admin can add custom ones)
INSERT INTO client_tag_definitions (name, color, icon, is_system) VALUES
  ('Hot Lead',    '#FF4444', 'fire',       TRUE),
  ('VIP',         '#FFD700', 'star',       TRUE),
  ('Lapsed',      '#9E9E9E', 'clock',      TRUE),
  ('New Client',  '#4CAF50', 'sparkle',    TRUE),
  ('Credit Risk', '#FF8C00', 'warning',    TRUE);

-- ─────────────────────────────────────────
-- CLIENT TAGS (many-to-many junction)
-- ─────────────────────────────────────────
CREATE TABLE client_tags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES client_tag_definitions(id) ON DELETE CASCADE,
  tagged_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  tagged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (client_id, tag_id)   -- Prevent duplicate tags on same client
);

CREATE INDEX idx_client_tags_client_id ON client_tags(client_id);
CREATE INDEX idx_client_tags_tag_id    ON client_tags(tag_id);

-- ─────────────────────────────────────────
-- CLIENT VISIT LOGS
-- Track when salesperson physically visited the client
-- Used for route planning and manager oversight
-- ─────────────────────────────────────────
CREATE TABLE client_visits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  salesperson_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geo_lat         NUMERIC(10, 7),
  geo_lng         NUMERIC(10, 7),
  notes           TEXT,
  outcome         VARCHAR(50)   -- 'order_placed', 'follow_up', 'not_available', 'refused'
                    CHECK (outcome IN ('order_placed', 'follow_up', 'not_available', 'refused', 'other'))
);

CREATE INDEX idx_client_visits_client_id      ON client_visits(client_id);
CREATE INDEX idx_client_visits_salesperson_id ON client_visits(salesperson_id);
CREATE INDEX idx_client_visits_visited_at     ON client_visits(visited_at DESC);
