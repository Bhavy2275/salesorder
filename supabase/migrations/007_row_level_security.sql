-- ============================================================
-- MIGRATION 007: Row Level Security (RLS) Policies
-- Supabase-specific: enforces RBAC at database level
-- Depends on: all previous migrations
-- 
-- IMPORTANT: Supabase uses the auth.uid() function to get the
-- currently authenticated user's ID from the JWT.
-- Our app passes the user's UUID as the JWT 'sub' claim.
-- ============================================================

-- ─────────────────────────────────────────
-- HELPER FUNCTION
-- Gets the current user's role from the users table
-- Used in RLS policies to avoid repeating subqueries
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid() AND deleted_at IS NULL;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Gets the current user's manager_id
CREATE OR REPLACE FUNCTION current_user_manager_id()
RETURNS UUID AS $$
  SELECT manager_id FROM users WHERE id = auth.uid() AND deleted_at IS NULL;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Gets all salesperson IDs that report to the current manager
CREATE OR REPLACE FUNCTION get_team_member_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT id FROM users
    WHERE manager_id = auth.uid()
    AND deleted_at IS NULL
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;


-- ═══════════════════════════════════════════════
-- ENABLE RLS ON ALL TABLES
-- ═══════════════════════════════════════════════

ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE territories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tag_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_visits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands              ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE schemes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns             ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════
-- USERS TABLE POLICIES
-- ═══════════════════════════════════════════════

-- Users can read their own profile
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (id = auth.uid());

-- Managers can read their team members
CREATE POLICY "managers_read_team" ON users
  FOR SELECT USING (
    current_user_role() IN ('manager', 'admin')
    AND (manager_id = auth.uid() OR id = auth.uid())
  );

-- Admin sees all users
CREATE POLICY "admin_read_all_users" ON users
  FOR SELECT USING (current_user_role() = 'admin');

-- Admin can insert / update users (user management)
CREATE POLICY "admin_manage_users" ON users
  FOR ALL USING (current_user_role() = 'admin');

-- Users can update their own non-sensitive fields
CREATE POLICY "users_update_own_profile" ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    -- Cannot escalate own role
    role = (SELECT role FROM users WHERE id = auth.uid())
  );


-- ═══════════════════════════════════════════════
-- CLIENTS TABLE POLICIES
-- ═══════════════════════════════════════════════

-- Salesperson sees only their assigned clients
CREATE POLICY "salesperson_read_own_clients" ON clients
  FOR SELECT USING (
    current_user_role() = 'salesperson'
    AND assigned_salesperson_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Manager sees their whole team's clients
CREATE POLICY "manager_read_team_clients" ON clients
  FOR SELECT USING (
    current_user_role() = 'manager'
    AND (
      assigned_salesperson_id = auth.uid()
      OR assigned_salesperson_id = ANY(get_team_member_ids())
    )
    AND deleted_at IS NULL
  );

-- Admin sees all clients
CREATE POLICY "admin_read_all_clients" ON clients
  FOR SELECT USING (current_user_role() = 'admin' AND deleted_at IS NULL);

-- Salesperson can create clients assigned to themselves
CREATE POLICY "salesperson_create_client" ON clients
  FOR INSERT WITH CHECK (
    current_user_role() IN ('salesperson', 'manager', 'admin')
    AND assigned_salesperson_id = auth.uid()
  );

-- Salesperson can update their own clients
CREATE POLICY "salesperson_update_own_clients" ON clients
  FOR UPDATE USING (
    current_user_role() IN ('salesperson', 'manager', 'admin')
    AND assigned_salesperson_id = auth.uid()
  );

-- Admin can do everything with clients
CREATE POLICY "admin_manage_all_clients" ON clients
  FOR ALL USING (current_user_role() = 'admin');


-- ═══════════════════════════════════════════════
-- PRODUCTS TABLE POLICIES
-- ═══════════════════════════════════════════════

-- All authenticated users can read active products (needed for catalogue)
CREATE POLICY "all_read_active_products" ON products
  FOR SELECT USING (is_active = TRUE AND deleted_at IS NULL);

-- Admin can manage all products (CRUD)
CREATE POLICY "admin_manage_products" ON products
  FOR ALL USING (current_user_role() = 'admin');


-- ═══════════════════════════════════════════════
-- ORDERS TABLE POLICIES
-- ═══════════════════════════════════════════════

-- Salesperson sees only their own orders
CREATE POLICY "salesperson_read_own_orders" ON orders
  FOR SELECT USING (
    current_user_role() = 'salesperson'
    AND salesperson_id = auth.uid()
  );

-- Manager sees their team's orders
CREATE POLICY "manager_read_team_orders" ON orders
  FOR SELECT USING (
    current_user_role() = 'manager'
    AND (
      salesperson_id = auth.uid()
      OR salesperson_id = ANY(get_team_member_ids())
    )
  );

-- Warehouse sees all orders that need fulfilment
CREATE POLICY "warehouse_read_active_orders" ON orders
  FOR SELECT USING (
    current_user_role() = 'warehouse'
    AND status IN ('confirmed', 'picking', 'packed', 'dispatched')
  );

-- Admin sees everything
CREATE POLICY "admin_read_all_orders" ON orders
  FOR SELECT USING (current_user_role() = 'admin');

-- Salesperson can create orders
CREATE POLICY "salesperson_create_order" ON orders
  FOR INSERT WITH CHECK (
    current_user_role() IN ('salesperson', 'manager')
    AND salesperson_id = auth.uid()
  );

-- Salesperson can update their own DRAFT orders
CREATE POLICY "salesperson_update_draft_orders" ON orders
  FOR UPDATE USING (
    salesperson_id = auth.uid()
    AND status = 'draft'
  );

-- Warehouse can update order status (picking/packed/dispatched/delivered)
CREATE POLICY "warehouse_update_order_status" ON orders
  FOR UPDATE USING (
    current_user_role() = 'warehouse'
    AND status IN ('confirmed', 'picking', 'packed', 'dispatched')
  );

-- Manager and admin can update any order
CREATE POLICY "manager_admin_update_orders" ON orders
  FOR UPDATE USING (
    current_user_role() IN ('manager', 'admin')
  );


-- ═══════════════════════════════════════════════
-- ORDER ITEMS TABLE POLICIES
-- ═══════════════════════════════════════════════

-- Order items inherit access from orders (join-based pattern)
CREATE POLICY "read_order_items_via_order" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
      AND (
        o.salesperson_id = auth.uid()
        OR o.salesperson_id = ANY(get_team_member_ids())
        OR current_user_role() IN ('admin', 'warehouse')
      )
    )
  );

CREATE POLICY "salesperson_insert_order_items" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
      AND o.salesperson_id = auth.uid()
      AND o.status = 'draft'
    )
  );


-- ═══════════════════════════════════════════════
-- OTP LOGS — IMMUTABLE (no update/delete policies)
-- ═══════════════════════════════════════════════

-- Salesperson can read OTP logs for their own orders
CREATE POLICY "salesperson_read_own_otp_logs" ON otp_logs
  FOR SELECT USING (salesperson_id = auth.uid());

-- Manager can read team's OTP logs
CREATE POLICY "manager_read_team_otp_logs" ON otp_logs
  FOR SELECT USING (
    current_user_role() IN ('manager', 'admin')
    AND (
      salesperson_id = auth.uid()
      OR salesperson_id = ANY(get_team_member_ids())
    )
  );

-- Anyone can insert OTP logs (API service account handles this)
CREATE POLICY "insert_otp_logs" ON otp_logs
  FOR INSERT WITH CHECK (TRUE);

-- NO UPDATE or DELETE policies — logs are immutable


-- ═══════════════════════════════════════════════
-- RETURNS TABLE POLICIES
-- ═══════════════════════════════════════════════

CREATE POLICY "salesperson_read_own_returns" ON returns
  FOR SELECT USING (salesperson_id = auth.uid());

CREATE POLICY "manager_read_team_returns" ON returns
  FOR SELECT USING (
    current_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "salesperson_create_return" ON returns
  FOR INSERT WITH CHECK (
    current_user_role() = 'salesperson'
    AND salesperson_id = auth.uid()
  );

CREATE POLICY "manager_approve_return" ON returns
  FOR UPDATE USING (current_user_role() IN ('manager', 'admin'));


-- ═══════════════════════════════════════════════
-- NOTIFICATIONS TABLE POLICIES
-- ═══════════════════════════════════════════════

-- Users only see their own notifications
CREATE POLICY "users_read_own_notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_update_own_notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- System/API inserts notifications (service role key bypasses RLS)


-- ═══════════════════════════════════════════════
-- READ-ONLY REFERENCE DATA (categories, brands, schemes)
-- All authenticated users can read; only admin can modify
-- ═══════════════════════════════════════════════

CREATE POLICY "all_read_categories" ON categories
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "admin_manage_categories" ON categories
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "all_read_brands" ON brands
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "admin_manage_brands" ON brands
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "all_read_active_schemes" ON schemes
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "admin_manage_schemes" ON schemes
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "all_read_territories" ON territories
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "admin_manage_territories" ON territories
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "admin_read_price_history" ON product_price_history
  FOR SELECT USING (current_user_role() IN ('admin', 'manager'));
