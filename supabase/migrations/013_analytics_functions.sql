-- ============================================================
-- MIGRATION 013: Sales Analytics Functions
-- Efficient aggregation queries for the manager dashboard
-- ============================================================

-- ─────────────────────────────────────────
-- get_revenue_trend
-- Daily revenue for the last N days
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_revenue_trend(
  p_days        INT DEFAULT 30,
  p_team_id     UUID DEFAULT NULL  -- NULL = all teams
)
RETURNS TABLE (
  date_day         DATE,
  order_count      BIGINT,
  gross_revenue    NUMERIC,
  total_gst        NUMERIC,
  net_revenue      NUMERIC,
  cancelled_count  BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(o.placed_at)           AS date_day,
    COUNT(*) FILTER (WHERE o.status != 'cancelled')  AS order_count,
    COALESCE(SUM(o.grand_total)  FILTER (WHERE o.status != 'cancelled'), 0) AS gross_revenue,
    COALESCE(SUM(o.total_gst)    FILTER (WHERE o.status != 'cancelled'), 0) AS total_gst,
    COALESCE(SUM(o.subtotal)     FILTER (WHERE o.status != 'cancelled'), 0) AS net_revenue,
    COUNT(*) FILTER (WHERE o.status = 'cancelled')   AS cancelled_count
  FROM orders o
  WHERE
    o.placed_at >= (CURRENT_DATE - p_days)
    AND (p_team_id IS NULL OR o.salesperson_id IN (
      SELECT id FROM users WHERE manager_id = p_team_id
    ))
  GROUP BY DATE(o.placed_at)
  ORDER BY date_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- get_salesperson_performance
-- Leaderboard for the last N days
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_salesperson_performance(
  p_days     INT DEFAULT 30,
  p_limit    INT DEFAULT 20
)
RETURNS TABLE (
  salesperson_id    UUID,
  salesperson_name  TEXT,
  employee_code     TEXT,
  total_orders      BIGINT,
  delivered_orders  BIGINT,
  cancelled_orders  BIGINT,
  gross_revenue     NUMERIC,
  clients_visited   BIGINT,
  conversion_rate   NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id                          AS salesperson_id,
    u.name                        AS salesperson_name,
    u.employee_code               AS employee_code,
    COUNT(o.id)                   AS total_orders,
    COUNT(o.id) FILTER (WHERE o.status = 'delivered')   AS delivered_orders,
    COUNT(o.id) FILTER (WHERE o.status = 'cancelled')   AS cancelled_orders,
    COALESCE(SUM(o.grand_total) FILTER (WHERE o.status NOT IN ('cancelled', 'draft')), 0) AS gross_revenue,
    COUNT(DISTINCT o.client_id)   AS clients_visited,
    CASE
      WHEN COUNT(o.id) > 0 THEN
        ROUND(
          COUNT(o.id) FILTER (WHERE o.status NOT IN ('cancelled', 'draft'))::NUMERIC
          / NULLIF(COUNT(o.id), 0) * 100,
          1
        )
      ELSE 0
    END                           AS conversion_rate
  FROM users u
  LEFT JOIN orders o ON o.salesperson_id = u.id
    AND o.placed_at >= (CURRENT_DATE - p_days)
  WHERE u.role = 'salesperson' AND u.is_active = true
  GROUP BY u.id, u.name, u.employee_code
  ORDER BY gross_revenue DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- get_top_products
-- Best selling products by revenue/quantity
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_top_products(
  p_days    INT DEFAULT 30,
  p_limit   INT DEFAULT 10,
  p_sort_by TEXT DEFAULT 'revenue'   -- 'revenue' | 'quantity'
)
RETURNS TABLE (
  product_id    UUID,
  product_name  TEXT,
  sku_code      TEXT,
  category_name TEXT,
  brand_name    TEXT,
  total_orders  BIGINT,
  total_qty     BIGINT,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id              AS product_id,
    p.name            AS product_name,
    p.sku_code        AS sku_code,
    cat.name          AS category_name,
    br.name           AS brand_name,
    COUNT(DISTINCT oi.order_id)  AS total_orders,
    SUM(oi.quantity)::BIGINT     AS total_qty,
    SUM(oi.line_total)           AS total_revenue
  FROM order_items oi
    JOIN orders o    ON o.id = oi.order_id
    JOIN products p  ON p.id = oi.product_id
    LEFT JOIN categories cat ON cat.id = p.category_id
    LEFT JOIN brands br      ON br.id = p.brand_id
  WHERE
    o.placed_at >= (CURRENT_DATE - p_days)
    AND o.status NOT IN ('cancelled', 'draft')
  GROUP BY p.id, p.name, p.sku_code, cat.name, br.name
  ORDER BY
    CASE WHEN p_sort_by = 'quantity' THEN SUM(oi.quantity) ELSE 0 END DESC,
    CASE WHEN p_sort_by = 'revenue'  THEN SUM(oi.line_total) ELSE 0 END DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- get_order_status_summary
-- Count by status for the given period
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_order_status_summary(p_days INT DEFAULT 30)
RETURNS TABLE (status TEXT, count BIGINT, revenue NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.status::TEXT,
    COUNT(*)             AS count,
    COALESCE(SUM(o.grand_total), 0) AS revenue
  FROM orders o
  WHERE o.placed_at >= (CURRENT_DATE - p_days)
  GROUP BY o.status
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────
-- get_dashboard_kpis
-- Single-call summary for the header KPIs
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_days INT DEFAULT 30)
RETURNS TABLE (
  total_orders     BIGINT,
  total_revenue    NUMERIC,
  avg_order_value  NUMERIC,
  total_clients    BIGINT,
  new_clients      BIGINT,
  total_items_sold BIGINT,
  vs_prev_revenue  NUMERIC  -- % change vs prior period
) AS $$
DECLARE
  v_prev_revenue NUMERIC;
BEGIN
  SELECT COALESCE(SUM(grand_total), 0) INTO v_prev_revenue
  FROM orders
  WHERE placed_at BETWEEN (CURRENT_DATE - p_days * 2) AND (CURRENT_DATE - p_days)
    AND status NOT IN ('cancelled', 'draft');

  RETURN QUERY
  SELECT
    COUNT(o.id)                                        AS total_orders,
    COALESCE(SUM(o.grand_total), 0)                    AS total_revenue,
    COALESCE(AVG(o.grand_total), 0)                    AS avg_order_value,
    COUNT(DISTINCT o.client_id)                        AS total_clients,
    COUNT(DISTINCT o.client_id) FILTER (
      WHERE o.client_id IN (
        SELECT id FROM clients WHERE DATE(created_at) >= (CURRENT_DATE - p_days)
      )
    )                                                  AS new_clients,
    COALESCE(SUM(oi.quantity), 0)::BIGINT              AS total_items_sold,
    CASE WHEN v_prev_revenue > 0 THEN
      ROUND(((COALESCE(SUM(o.grand_total), 0) - v_prev_revenue) / v_prev_revenue) * 100, 1)
    ELSE 0 END                                         AS vs_prev_revenue
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE
    o.placed_at >= (CURRENT_DATE - p_days)
    AND o.status NOT IN ('cancelled', 'draft');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
