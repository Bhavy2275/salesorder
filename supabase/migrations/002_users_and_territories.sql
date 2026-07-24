-- ============================================================
-- MIGRATION 002: Core User & Territory Tables
-- Depends on: 001_enums_and_extensions.sql
-- ============================================================

-- ─────────────────────────────────────────
-- TERRITORIES
-- Geographic zones assigned to salespersons/managers
-- ─────────────────────────────────────────
CREATE TABLE territories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL UNIQUE,  -- e.g., "Mumbai North", "Delhi NCR"
  description   TEXT,
  state         VARCHAR(100),
  city          VARCHAR(100),
  pincode_range VARCHAR(20),                   -- e.g., "400001-400099" for broad coverage
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_territories_updated_at
  BEFORE UPDATE ON territories
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────
-- USERS
-- All platform users: salesperson, manager, warehouse, admin
-- ─────────────────────────────────────────
CREATE TABLE users (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                    VARCHAR(200) NOT NULL,
  mobile                  VARCHAR(15) NOT NULL UNIQUE,    -- Primary login identifier
  email                   VARCHAR(255) UNIQUE,
  password_hash           TEXT NOT NULL,                  -- bcrypt hash
  role                    user_role NOT NULL DEFAULT 'salesperson',

  -- Hierarchy: salesperson reports to manager
  manager_id              UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Territory assignment
  territory_id            UUID REFERENCES territories(id) ON DELETE SET NULL,

  -- Performance targets (monthly)
  target_monthly_revenue  NUMERIC(12, 2) DEFAULT 0,
  target_monthly_orders   INTEGER DEFAULT 0,

  -- Price tier this salesperson can offer to clients by default
  default_price_tier      price_tier NOT NULL DEFAULT 'retailer',

  -- Profile
  avatar_url              TEXT,                           -- Cloudinary URL
  employee_code           VARCHAR(50) UNIQUE,             -- Internal HR code
  joining_date            DATE,

  -- Auth & session control
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  is_email_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  refresh_token_hash      TEXT,                           -- Hashed refresh token (latest)
  last_login_at           TIMESTAMPTZ,
  failed_login_attempts   SMALLINT NOT NULL DEFAULT 0,
  locked_until            TIMESTAMPTZ,                    -- Account lock after N failed attempts

  -- 2FA (required for admin role)
  totp_secret             TEXT,                           -- TOTP secret for admin 2FA
  totp_enabled            BOOLEAN NOT NULL DEFAULT FALSE,

  -- Soft delete
  deleted_at              TIMESTAMPTZ,                    -- NULL = active

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookup patterns
CREATE INDEX idx_users_role           ON users(role)       WHERE deleted_at IS NULL;
CREATE INDEX idx_users_manager_id     ON users(manager_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_territory_id   ON users(territory_id);
CREATE INDEX idx_users_mobile         ON users(mobile);
CREATE INDEX idx_users_employee_code  ON users(employee_code) WHERE employee_code IS NOT NULL;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────
-- USER DEVICE TOKENS
-- FCM push notification device registry
-- One user can have multiple devices (phone + tablet)
-- ─────────────────────────────────────────
CREATE TABLE user_device_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token     TEXT NOT NULL,
  device_id     VARCHAR(255) NOT NULL,            -- Unique hardware/install ID
  platform      VARCHAR(10) NOT NULL              -- 'ios' | 'android' | 'web'
                  CHECK (platform IN ('ios', 'android', 'web')),
  app_version   VARCHAR(20),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One device ID = one token row per user
  UNIQUE (user_id, device_id)
);

CREATE INDEX idx_device_tokens_user_id ON user_device_tokens(user_id) WHERE is_active = TRUE;
