-- ============================================================
-- MIGRATION 008: Database Views
-- Pre-computed views for common API queries
-- Reduces N+1 queries and simplifies the backend
-- Depends on: all previous migrations
-- ============================================================

-- ─────────────────────────────────────────
-- VIEW: order_summary
-- Used by salesperson dashboard and order list screens
-- Joins orders with client + salesperson info
-- ─────────────────────────────────────────
CREATE VIEW order_summary AS
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
  o.otp_verified,
  o.created_at,
  o.placed_at,
  o.dispatched_at,
  o.delivered_at,
  o.cancelled_at,

  -- Client details
  c.id            AS client_id,
  c.business_name AS client_name,
  c.mobile_primary AS client_mobile,
  c.geo_lat       AS client_lat,
  c.geo_lng       AS client_lng,

  -- Salesperson details
  sp.id           AS salesperson_id,
  sp.name         AS salesperson_name,
  sp.mobile       AS salesperson_mobile,

  -- Item count (aggregated from order_items)
  (
    SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id
  )               AS item_count,

  -- Total quantity
  (
    SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id
  )               AS total_quantity

FROM orders o
JOIN clients c    ON c.id = o.client_id
JOIN users sp     ON sp.id = o.salesperson_id;

-- ─────────────────────────────────────────
-- VIEW: salesperson_performance
-- Used by salesperson dashboard and manager leaderboard
-- Aggregates last 30-day performance per salesperson
-- ─────────────────────────────────────────
CREATE VIEW salesperson_performance AS
SELECT
  u.id                    AS salesperson_id,
  u.name                  AS salesperson_name,
  u.employee_code,
  u.target_monthly_revenue,
  u.target_monthly_orders,
  t.name                  AS territory_name,

  -- Orders in last 30 days
  COUNT(o.id)             AS orders_last_30d,
  COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) AS orders_delivered_30d,
  COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) AS orders_cancelled_30d,

  -- Revenue
  COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'draft') THEN o.grand_total END), 0)
                          AS revenue_last_30d,
  COALESCE(AVG(CASE WHEN o.status NOT IN ('cancelled', 'draft') THEN o.grand_total END), 0)
                          AS avg_order_value_30d,

  -- Total items sold
  COALESCE(SUM(oi_agg.total_items), 0) AS items_sold_30d,

  -- Active clients (ordered in last 30d)
  COUNT(DISTINCT o.client_id) AS active_clients_30d

FROM users u
LEFT JOIN territories t ON t.id = u.territory_id
LEFT JOIN orders o ON
  o.salesperson_id = u.id
  AND o.created_at >= NOW() - INTERVAL '30 days'
  AND o.status != 'draft'
LEFT JOIN LATERAL (
  SELECT order_id, SUM(quantity) AS total_items
  FROM order_items
  WHERE order_id = o.id
  GROUP BY order_id
) oi_agg ON TRUE
WHERE u.role = 'salesperson'
  AND u.deleted_at IS NULL
  AND u.is_active = TRUE
GROUP BY u.id, u.name, u.employee_code, u.target_monthly_revenue, u.target_monthly_orders, t.name;

-- ─────────────────────────────────────────
-- VIEW: product_stock_status
-- Used by warehouse + admin to monitor inventory levels
-- ─────────────────────────────────────────
CREATE VIEW product_stock_status AS
SELECT
  p.id,
  p.name,
  p.sku_code,
  p.stock_qty,
  p.reserved_qty,
  (p.stock_qty - p.reserved_qty) AS available_qty,
  p.low_stock_threshold,
  CASE
    WHEN p.stock_qty = 0                            THEN 'out_of_stock'
    WHEN p.stock_qty <= p.low_stock_threshold       THEN 'low_stock'
    ELSE                                                 'in_stock'
  END                             AS stock_status,
  c.name                          AS category_name,
  b.name                          AS brand_name,
  p.retailer_price,
  p.mrp,
  p.gst_percent,
  p.is_active,
  p.updated_at                    AS last_updated
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN brands b     ON b.id = p.brand_id
WHERE p.deleted_at IS NULL;

-- ─────────────────────────────────────────
-- VIEW: client_overview
-- Used by salesperson's client list screen
-- Includes latest tag names and last order info
-- ─────────────────────────────────────────
CREATE VIEW client_overview AS
SELECT
  c.id,
  c.business_name,
  c.contact_person,
  c.mobile_primary,
  c.business_type,
  c.price_tier,
  c.credit_limit,
  c.outstanding_balance,
  c.payment_terms,
  c.client_photo_url,
  c.last_order_at,
  c.last_visited_at,
  c.total_orders,
  c.total_revenue,
  c.geo_lat,
  c.geo_lng,
  c.notes,
  c.assigned_salesperson_id,
  c.territory_id,
  c.created_at,

  -- Tags as JSON array: [{id, name, color}]
  COALESCE(
    (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT('id', td.id, 'name', td.name, 'color', td.color, 'icon', td.icon)
      )
      FROM client_tags ct
      JOIN client_tag_definitions td ON td.id = ct.tag_id
      WHERE ct.client_id = c.id
    ),
    '[]'
  )                         AS tags,

  -- Last order summary
  (
    SELECT JSON_BUILD_OBJECT(
      'order_number', o.order_number,
      'status', o.status,
      'grand_total', o.grand_total,
      'created_at', o.created_at
    )
    FROM orders o
    WHERE o.client_id = c.id
    ORDER BY o.created_at DESC
    LIMIT 1
  )                         AS last_order

FROM clients c
WHERE c.deleted_at IS NULL;

-- ─────────────────────────────────────────
-- VIEW: warehouse_order_queue
-- What the warehouse team sees when they log in
-- Orders ready for action, sorted by priority
-- ─────────────────────────────────────────
CREATE VIEW warehouse_order_queue AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.delivery_date,
  o.grand_total,
  o.payment_terms,
  o.notes                   AS order_notes,
  o.placed_at,

  -- Client info
  c.business_name           AS client_name,
  c.mobile_primary          AS client_mobile,
  c.delivery_address,
  c.geo_lat,
  c.geo_lng,

  -- Salesperson info
  sp.name                   AS salesperson_name,
  sp.mobile                 AS salesperson_mobile,

  -- Item list (as JSON array for single-query fetch)
  (
    SELECT JSON_AGG(
      JSON_BUILD_OBJECT(
        'product_name', oi.product_name,
        'sku_code', oi.sku_code,
        'quantity', oi.quantity,
        'unit', oi.unit,
        'free_qty', oi.free_qty
      )
      ORDER BY oi.product_name
    )
    FROM order_items oi WHERE oi.order_id = o.id
  )                         AS items,

  (
    SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id
  )                         AS total_qty

FROM orders o
JOIN clients c ON c.id = o.client_id
JOIN users sp  ON sp.id = o.salesperson_id
WHERE o.status IN ('confirmed', 'picking', 'packed')
ORDER BY
  -- Priority: packed first, then picking, then confirmed
  CASE o.status
    WHEN 'packed'     THEN 1
    WHEN 'picking'    THEN 2
    WHEN 'confirmed'  THEN 3
  END,
  -- Within same status, sort by requested delivery date
  o.delivery_date ASC NULLS LAST,
  o.placed_at ASC;
