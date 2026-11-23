-- ============================================================
-- MIGRATION 006: Returns, Credit Notes & Notifications
-- Depends on: 005_orders_and_otp.sql
-- ============================================================

-- ─────────────────────────────────────────
-- RETURNS
-- Initiated by salesperson; requires manager approval
-- ─────────────────────────────────────────
CREATE TABLE returns (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  salesperson_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  status              return_status NOT NULL DEFAULT 'requested',
  return_reason       return_reason NOT NULL,
  notes               TEXT,

  -- Manager approval
  reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,

  -- Financial summary (populated after approval)
  total_return_value  NUMERIC(12, 2),                     -- Credit note amount

  -- Proof of return
  photo_urls          TEXT[] NOT NULL DEFAULT '{}',        -- Cloudinary URLs

  -- Soft delete is not applicable here — returns are permanent records
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_returns_order_id        ON returns(order_id);
CREATE INDEX idx_returns_salesperson_id  ON returns(salesperson_id);
CREATE INDEX idx_returns_status          ON returns(status);

CREATE TRIGGER set_returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────
-- RETURN ITEMS
-- Line-level detail of what is being returned
-- ─────────────────────────────────────────
CREATE TABLE return_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id       UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id   UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  return_quantity INTEGER NOT NULL CHECK (return_quantity > 0),
  unit_price      NUMERIC(10, 2) NOT NULL,                -- Price at which it was sold
  gst_percent     NUMERIC(5, 2) NOT NULL DEFAULT 0,
  return_value    NUMERIC(12, 2) NOT NULL,                -- return_quantity × unit_price + gst
  reason          return_reason NOT NULL,
  condition       VARCHAR(50)                             -- 'sealed', 'opened', 'damaged'
                    CHECK (condition IN ('sealed', 'opened', 'damaged', 'partial')),
  notes           TEXT
);

CREATE INDEX idx_return_items_return_id  ON return_items(return_id);
CREATE INDEX idx_return_items_product_id ON return_items(product_id);

-- ─────────────────────────────────────────
-- CREDIT NOTES
-- Issued to client after return is approved
-- Applied to future orders
-- ─────────────────────────────────────────
CREATE TABLE credit_notes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id           UUID NOT NULL UNIQUE REFERENCES returns(id) ON DELETE RESTRICT,
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,

  -- Human-readable reference
  credit_note_number  VARCHAR(30) NOT NULL UNIQUE,

  amount              NUMERIC(12, 2) NOT NULL,
  remaining_amount    NUMERIC(12, 2) NOT NULL,            -- Decreases as applied to orders
  currency            VARCHAR(3) NOT NULL DEFAULT 'INR',

  issued_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          DATE,                               -- NULL = no expiry

  is_fully_used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE credit_note_seq START 1;

CREATE OR REPLACE FUNCTION generate_credit_note_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.credit_note_number IS NULL OR NEW.credit_note_number = '' THEN
    NEW.credit_note_number := 'CN-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                              LPAD(NEXTVAL('credit_note_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_credit_note_number
  BEFORE INSERT ON credit_notes
  FOR EACH ROW EXECUTE FUNCTION generate_credit_note_number();

CREATE TRIGGER set_credit_notes_updated_at
  BEFORE UPDATE ON credit_notes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_credit_notes_client_id ON credit_notes(client_id);
CREATE INDEX idx_credit_notes_return_id ON credit_notes(return_id);

-- ─────────────────────────────────────────
-- CREDIT NOTE APPLICATIONS
-- Tracks how and when a credit note was used against an order
-- ─────────────────────────────────────────
CREATE TABLE credit_note_applications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_note_id  UUID NOT NULL REFERENCES credit_notes(id) ON DELETE RESTRICT,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  amount_applied  NUMERIC(12, 2) NOT NULL CHECK (amount_applied > 0),
  applied_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cn_applications_credit_note_id ON credit_note_applications(credit_note_id);
CREATE INDEX idx_cn_applications_order_id       ON credit_note_applications(order_id);

-- ─────────────────────────────────────────
-- NOTIFICATIONS
-- In-app + push notification log
-- Kept for 90 days then purged (see scheduled cleanup job in API)
-- ─────────────────────────────────────────
CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              notification_type NOT NULL,
  title             VARCHAR(255) NOT NULL,
  body              TEXT NOT NULL,

  -- Optional deep-link payload: { screen, params }
  data              JSONB DEFAULT '{}',

  -- Related entities (for navigation on tap)
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
  return_id         UUID REFERENCES returns(id) ON DELETE SET NULL,

  -- Delivery tracking
  sent_via_push     BOOLEAN NOT NULL DEFAULT FALSE,
  push_sent_at      TIMESTAMPTZ,
  push_fcm_id       TEXT,                               -- FCM message ID for receipts

  -- Read state
  is_read           BOOLEAN NOT NULL DEFAULT FALSE,
  read_at           TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX idx_notifications_is_read    ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type       ON notifications(type);

-- Auto-expire old notifications (>90 days) via pg_cron or the API cron job.
-- NOW() is not immutable, so it cannot be used in a partial index predicate.
CREATE INDEX idx_notifications_cleanup    ON notifications(created_at);
