-- All-orders warehouse view and summary metrics for the simplified overview.
ALTER TYPE payment_terms ADD VALUE IF NOT EXISTS 'online';

CREATE OR REPLACE VIEW warehouse_fulfilment_queue AS
SELECT
  o.id, o.order_number, o.status, o.grand_total, o.subtotal, o.total_gst,
  o.discount_amount, o.payment_terms, o.delivery_date, o.placed_at,
  o.dispatched_at, o.delivered_at, o.notes, o.pdf_url, o.cancel_reason,
  COUNT(oi.id) AS item_count,
  COALESCE(SUM(oi.quantity), 0) AS total_quantity,
  c.business_name AS client_name,
  c.mobile_primary AS client_mobile,
  c.delivery_address AS delivery_address,
  u.name AS salesperson_name, u.mobile AS salesperson_mobile,
  u.employee_code AS salesperson_code,
  CASE WHEN o.delivery_date IS NOT NULL AND o.delivery_date < CURRENT_DATE THEN true ELSE false END AS is_overdue,
  CASE WHEN o.delivery_date IS NOT NULL THEN o.delivery_date - CURRENT_DATE ELSE NULL END AS days_until_delivery,
  c.gst_number AS client_gst,
  STRING_AGG(DISTINCT oi.product_name, ' ') AS item_names
FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  JOIN clients c ON c.id = o.client_id
  JOIN users u ON u.id = o.salesperson_id
GROUP BY o.id, c.business_name, c.mobile_primary, c.gst_number, c.delivery_address,
  u.name, u.mobile, u.employee_code;

DROP FUNCTION IF EXISTS get_warehouse_daily_stats();
CREATE FUNCTION get_warehouse_daily_stats()
RETURNS TABLE (
  total_placed BIGINT, total_picking BIGINT, total_packed BIGINT,
  total_dispatched BIGINT, total_delivered BIGINT, total_cancelled BIGINT,
  revenue_today NUMERIC, avg_fulfil_mins NUMERIC,
  total_orders BIGINT, total_quantity BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE o.status = 'placed'),
    COUNT(*) FILTER (WHERE o.status = 'picking'),
    COUNT(*) FILTER (WHERE o.status = 'packed'),
    COUNT(*) FILTER (WHERE o.status = 'dispatched'),
    COUNT(*) FILTER (WHERE o.status = 'delivered' AND DATE(o.delivered_at) = CURRENT_DATE),
    COUNT(*) FILTER (WHERE o.status = 'cancelled' AND DATE(o.cancelled_at) = CURRENT_DATE),
    COALESCE(SUM(o.grand_total) FILTER (WHERE o.status = 'delivered' AND DATE(o.delivered_at) = CURRENT_DATE), 0),
    COALESCE(AVG(EXTRACT(EPOCH FROM (o.dispatched_at - o.placed_at)) / 60)
      FILTER (WHERE o.dispatched_at IS NOT NULL AND o.placed_at IS NOT NULL), 0),
    (SELECT COUNT(*) FROM orders),
    COALESCE((SELECT SUM(oi.quantity) FROM order_items oi), 0)
  FROM orders o
  WHERE DATE(o.placed_at) = CURRENT_DATE OR DATE(o.delivered_at) = CURRENT_DATE OR DATE(o.cancelled_at) = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
