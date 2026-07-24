-- ============================================================
-- MIGRATION 010: Utility RPC Functions
-- Postgres functions called via supabase.rpc()
-- These run inside transactions for atomicity
-- ============================================================

-- ─────────────────────────────────────────
-- adjust_product_stock
-- Atomically adjusts stock_qty for a product.
-- Prevents race conditions from concurrent order placements.
-- Returns the updated product row.
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION adjust_product_stock(
  p_product_id UUID,
  p_delta      INTEGER,
  p_reason     TEXT DEFAULT 'manual'
)
RETURNS products AS $$
DECLARE
  v_product products;
BEGIN
  -- Lock the row for update to prevent concurrent modifications
  SELECT * INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  -- Prevent stock from going negative (unless backorders allowed)
  IF NOT v_product.allow_backorder AND (v_product.stock_qty + p_delta) < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, requested reduction: %',
      v_product.stock_qty, ABS(p_delta);
  END IF;

  -- Apply the adjustment
  UPDATE products
  SET stock_qty = GREATEST(0, stock_qty + p_delta)
  WHERE id = p_product_id
  RETURNING * INTO v_product;

  RETURN v_product;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- reserve_stock
-- Called when an order is placed — reserves stock to prevent overselling.
-- Decrements available qty without removing from stock_qty.
-- stock_qty remains the physical count; reserved_qty is the "soft lock".
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id UUID,
  p_quantity   INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_available INTEGER;
BEGIN
  SELECT (stock_qty - reserved_qty) INTO v_available
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Cannot reserve % units. Available: %', p_quantity, v_available;
  END IF;

  UPDATE products
  SET reserved_qty = reserved_qty + p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- release_stock_reservation
-- Called when an order is cancelled — releases reserved qty back to available.
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION release_stock_reservation(
  p_product_id UUID,
  p_quantity   INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET reserved_qty = GREATEST(0, reserved_qty - p_quantity)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- confirm_stock_sale
-- Called when order is dispatched — converts reservation to actual stock reduction.
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION confirm_stock_sale(
  p_product_id UUID,
  p_quantity   INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET
    stock_qty    = GREATEST(0, stock_qty - p_quantity),
    reserved_qty = GREATEST(0, reserved_qty - p_quantity)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
