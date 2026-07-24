-- ============================================================
-- MIGRATION 011: Order Transaction RPC Functions
-- Atomic order creation and cancellation
-- These prevent partial state where order is created but items/stock are not
-- ============================================================

-- ─────────────────────────────────────────
-- create_order_with_items
-- Creates order + order_items + reserves stock — all in one transaction.
-- If any step fails, the whole thing rolls back.
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_salesperson_id    UUID,
  p_client_id         UUID,
  p_manager_id        UUID,
  p_delivery_address  JSONB,
  p_delivery_date     DATE,
  p_payment_terms     payment_terms,
  p_notes             TEXT,
  p_local_draft_id    TEXT,
  p_created_offline   BOOLEAN,
  p_subtotal          NUMERIC,
  p_total_gst         NUMERIC,
  p_discount_amount   NUMERIC,
  p_grand_total       NUMERIC,
  p_otp_sent_to       VARCHAR,
  p_items             JSONB   -- Array of order item objects
)
RETURNS orders AS $$
DECLARE
  v_order     orders;
  v_item      JSONB;
  v_product   products;
BEGIN
  -- ── Step 1: Create the order ──────────────────────────────────────────────
  INSERT INTO orders (
    salesperson_id, client_id, manager_id,
    status, delivery_address, delivery_date, payment_terms,
    notes, local_draft_id, created_offline,
    subtotal, total_gst, discount_amount, grand_total,
    otp_sent_to
  ) VALUES (
    p_salesperson_id, p_client_id, p_manager_id,
    'draft', p_delivery_address, p_delivery_date, p_payment_terms,
    p_notes, p_local_draft_id, p_created_offline,
    p_subtotal, p_total_gst, p_discount_amount, p_grand_total,
    p_otp_sent_to
  )
  RETURNING * INTO v_order;

  -- ── Step 2: Insert order items + reserve stock ───────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Lock the product row to prevent concurrent stock changes
    SELECT * INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    -- Check stock availability (re-validate inside transaction)
    IF NOT v_product.allow_backorder AND
       (v_product.stock_qty - v_product.reserved_qty) < (v_item->>'quantity')::INTEGER THEN
      RAISE EXCEPTION 'Insufficient stock for product % (%). Available: %, Requested: %',
        v_product.name, v_product.id,
        (v_product.stock_qty - v_product.reserved_qty),
        (v_item->>'quantity')::INTEGER;
    END IF;

    -- Reserve stock
    UPDATE products
    SET reserved_qty = reserved_qty + (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'product_id')::UUID;

    -- Insert order item
    INSERT INTO order_items (
      order_id, product_id, product_name, sku_code,
      quantity, unit, unit_price,
      gst_percent, gst_amount, discount_amount, line_total,
      scheme_id, scheme_name, free_qty
    ) VALUES (
      v_order.id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      v_item->>'sku_code',
      (v_item->>'quantity')::INTEGER,
      v_item->>'unit',
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'gst_percent')::NUMERIC,
      (v_item->>'gst_amount')::NUMERIC,
      (v_item->>'discount_amount')::NUMERIC,
      (v_item->>'line_total')::NUMERIC,
      CASE WHEN v_item->>'scheme_id' IS NOT NULL AND v_item->>'scheme_id' != 'null'
           THEN (v_item->>'scheme_id')::UUID ELSE NULL END,
      v_item->>'scheme_name',
      COALESCE((v_item->>'free_qty')::INTEGER, 0)
    );
  END LOOP;

  RETURN v_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- cancel_order_and_release_stock
-- Cancels an order and releases all stock reservations atomically.
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_order_and_release_stock(
  p_order_id      UUID,
  p_reason        TEXT,
  p_cancelled_by  UUID
)
RETURNS VOID AS $$
DECLARE
  v_item  order_items;
BEGIN
  -- Lock the order row
  UPDATE orders
  SET
    status        = 'cancelled',
    cancelled_at  = NOW(),
    cancel_reason = p_reason,
    cancelled_by  = p_cancelled_by
  WHERE id = p_order_id
    AND status NOT IN ('cancelled', 'delivered');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % cannot be cancelled in its current state.', p_order_id;
  END IF;

  -- Release stock reservation for each item
  FOR v_item IN
    SELECT * FROM order_items WHERE order_id = p_order_id
  LOOP
    UPDATE products
    SET reserved_qty = GREATEST(0, reserved_qty - v_item.quantity)
    WHERE id = v_item.product_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
