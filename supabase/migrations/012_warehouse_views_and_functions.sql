-- ============================================================
-- MIGRATION 012: Warehouse Views & Functions
-- Optimised queries for the warehouse fulfilment queue
-- ============================================================

-- ─────────────────────────────────────────
-- warehouse_fulfilment_queue (view)
-- Used by GET /api/warehouse/queue
-- Returns all actionable orders sorted by priority
-- Priority: delivery_date ASC, then placed_at ASC (FIFO)
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW warehouse_fulfilment_queue AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.grand_total,
  o.subtotal,
  o.total_gst,
  o.discount_amount,
  o.payment_terms,
  o.delivery_date,
  o.placed_at,
  o.dispatched_at,
  o.delivered_at,
  o.notes,
  o.pdf_url,
  o.cancel_reason,
  -- Item count
  COUNT(oi.id)           AS item_count,
  SUM(oi.quantity)       AS total_quantity,
  -- Client info
  c.business_name        AS client_name,
  c.mobile_primary       AS client_mobile,
  c.delivery_address     AS delivery_address,
  -- Salesperson info
  u.name                 AS salesperson_name,
  u.mobile               AS salesperson_mobile,
  u.employee_code        AS salesperson_code,
  -- Priority flag: overdue if delivery_date < today
  CASE
    WHEN o.delivery_date IS NOT NULL AND o.delivery_date < CURRENT_DATE THEN true
    ELSE false
  END AS is_overdue,
  -- Days until delivery
  CASE
    WHEN o.delivery_date IS NOT NULL THEN (o.delivery_date - CURRENT_DATE)
    ELSE NULL
  END AS days_until_delivery
FROM orders o
  JOIN order_items oi    ON oi.order_id = o.id
  JOIN clients c         ON c.id = o.client_id
  JOIN users u           ON u.id = o.salesperson_id
WHERE
  o.status IN ('placed', 'picking', 'packed', 'dispatched')
GROUP BY
  o.id, c.business_name, c.mobile_primary, c.delivery_address,
  u.name, u.mobile, u.employee_code
ORDER BY
  -- Overdue first
  is_overdue DESC,
  -- Then by delivery date (soonest first)
  o.delivery_date ASC NULLS LAST,
  -- Then FIFO within same delivery date
  o.placed_at ASC;

-- ─────────────────────────────────────────
-- warehouse_daily_stats (function)
-- Returns today's fulfilment statistics
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_warehouse_daily_stats()
RETURNS TABLE (
  total_placed     BIGINT,
  total_picking    BIGINT,
  total_packed     BIGINT,
  total_dispatched BIGINT,
  total_delivered  BIGINT,
  total_cancelled  BIGINT,
  revenue_today    NUMERIC,
  avg_fulfil_mins  NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'placed')                           AS total_placed,
    COUNT(*) FILTER (WHERE status = 'picking')                          AS total_picking,
    COUNT(*) FILTER (WHERE status = 'packed')                           AS total_packed,
    COUNT(*) FILTER (WHERE status = 'dispatched')                       AS total_dispatched,
    COUNT(*) FILTER (WHERE status = 'delivered' AND DATE(delivered_at) = CURRENT_DATE) AS total_delivered,
    COUNT(*) FILTER (WHERE status = 'cancelled' AND DATE(cancelled_at) = CURRENT_DATE) AS total_cancelled,
    COALESCE(SUM(grand_total) FILTER (
      WHERE status = 'delivered' AND DATE(delivered_at) = CURRENT_DATE
    ), 0)                                                               AS revenue_today,
    COALESCE(AVG(
      EXTRACT(EPOCH FROM (dispatched_at - placed_at)) / 60
    ) FILTER (WHERE dispatched_at IS NOT NULL AND placed_at IS NOT NULL), 0) AS avg_fulfil_mins
  FROM orders
  WHERE
    DATE(placed_at) = CURRENT_DATE OR
    DATE(delivered_at) = CURRENT_DATE OR
    DATE(cancelled_at) = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- transition_order_status (function)
-- Validates and applies allowed status transitions.
-- Prevents illegal jumps (e.g., placed → delivered).
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION transition_order_status(
  p_order_id     UUID,
  p_new_status   order_status,
  p_updated_by   UUID,
  p_proof_url    TEXT DEFAULT NULL,
  p_notes        TEXT DEFAULT NULL
)
RETURNS orders AS $$
DECLARE
  v_order         orders;
  v_allowed_next  order_status[];
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found.', p_order_id;
  END IF;

  -- Define allowed next states for each current state
  CASE v_order.status
    WHEN 'placed'     THEN v_allowed_next := ARRAY['picking', 'cancelled']::order_status[];
    WHEN 'picking'    THEN v_allowed_next := ARRAY['packed', 'cancelled']::order_status[];
    WHEN 'packed'     THEN v_allowed_next := ARRAY['dispatched']::order_status[];
    WHEN 'dispatched' THEN v_allowed_next := ARRAY['delivered']::order_status[];
    ELSE v_allowed_next := ARRAY[]::order_status[];
  END CASE;

  IF NOT (p_new_status = ANY(v_allowed_next)) THEN
    RAISE EXCEPTION 'Invalid transition: % → %. Allowed: %',
      v_order.status, p_new_status,
      array_to_string(v_allowed_next, ', ');
  END IF;

  -- Apply transition with appropriate timestamps
  UPDATE orders
  SET
    status          = p_new_status,
    picking_started_at  = CASE WHEN p_new_status = 'picking'    THEN NOW() ELSE picking_started_at END,
    packed_at           = CASE WHEN p_new_status = 'packed'     THEN NOW() ELSE packed_at END,
    dispatched_at       = CASE WHEN p_new_status = 'dispatched' THEN NOW() ELSE dispatched_at END,
    delivered_at        = CASE WHEN p_new_status = 'delivered'  THEN NOW() ELSE delivered_at END,
    delivery_proof_url  = COALESCE(p_proof_url, delivery_proof_url),
    warehouse_notes     = COALESCE(p_notes, warehouse_notes),
    updated_by          = p_updated_by
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
