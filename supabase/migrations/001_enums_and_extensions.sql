-- ============================================================
-- MIGRATION 001: Extensions & Custom Enum Types
-- Sales Order B2B Field Sales Platform
-- Run this FIRST before any other migration
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_crypto for hashing (used in OTP verification)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable PostGIS for geospatial queries (territory heatmaps, geo tagging)
-- CREATE EXTENSION IF NOT EXISTS "postgis";  -- Uncomment if PostGIS is available on your Supabase plan

-- ─────────────────────────────────────────
-- USER ROLES
-- ─────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
  'salesperson',
  'manager',
  'warehouse',
  'admin'
);

-- ─────────────────────────────────────────
-- ORDER LIFECYCLE STATUS
-- ─────────────────────────────────────────
CREATE TYPE order_status AS ENUM (
  'draft',        -- Saved locally, not yet submitted
  'placed',       -- Submitted by salesperson, OTP pending
  'confirmed',    -- OTP verified by client
  'picking',      -- Warehouse started picking
  'packed',       -- All items packed
  'dispatched',   -- Out for delivery
  'delivered',    -- Delivered to client
  'cancelled',    -- Cancelled (with reason)
  'returned'      -- Return initiated and processed
);

-- ─────────────────────────────────────────
-- CLIENT BUSINESS TYPES
-- ─────────────────────────────────────────
CREATE TYPE business_type AS ENUM (
  'retailer',
  'distributor',
  'wholesaler',
  'institution',  -- Schools, hospitals, corporates
  'other'
);

-- ─────────────────────────────────────────
-- PRICE TIERS (per PRD section 5.4)
-- ─────────────────────────────────────────
CREATE TYPE price_tier AS ENUM (
  'retailer',
  'distributor',
  'wholesale',
  'vip'
);

-- ─────────────────────────────────────────
-- SCHEME TYPES
-- ─────────────────────────────────────────
CREATE TYPE scheme_type AS ENUM (
  'quantity_based',   -- Buy X get Y free
  'value_based',      -- Spend ₹Z get N% off
  'flat_discount',    -- Fixed ₹ off on product
  'percentage'        -- % off on product/category
);

-- ─────────────────────────────────────────
-- RETURN REASONS
-- ─────────────────────────────────────────
CREATE TYPE return_reason AS ENUM (
  'damaged',
  'wrong_item',
  'excess_quantity',
  'quality_issue',
  'client_refused',
  'other'
);

-- ─────────────────────────────────────────
-- RETURN STATUS
-- ─────────────────────────────────────────
CREATE TYPE return_status AS ENUM (
  'requested',    -- Salesperson initiated
  'approved',     -- Manager approved
  'rejected',     -- Manager rejected
  'processed',    -- Credit note issued
  'completed'     -- Stock adjusted in warehouse
);

-- ─────────────────────────────────────────
-- NOTIFICATION TYPES
-- ─────────────────────────────────────────
CREATE TYPE notification_type AS ENUM (
  'order_status',       -- Order lifecycle update
  'low_stock',          -- Product below threshold
  'scheme_expiry',      -- Scheme expiring soon
  'daily_reminder',     -- Morning nudge
  'discount_approval',  -- Manager approval request
  'return_update'       -- Return status change
);

-- ─────────────────────────────────────────
-- PAYMENT TERMS
-- ─────────────────────────────────────────
CREATE TYPE payment_terms AS ENUM (
  'cash',
  'net_7',
  'net_15',
  'net_30',
  'net_45',
  'net_60',
  'credit'
);

-- ─────────────────────────────────────────
-- REUSABLE updated_at TRIGGER FUNCTION
-- Automatically stamps updated_at on any row update
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
