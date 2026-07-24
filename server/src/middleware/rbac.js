/**
 * rbac.js — Role-Based Access Control Middleware
 *
 * Usage:
 *   // Allow only admins
 *   router.post('/products', authenticate, authorize('admin'), handler);
 *
 *   // Allow multiple roles
 *   router.get('/orders', authenticate, authorize('manager', 'admin'), handler);
 *
 *   // Named permission checks (semantic, readable in route definitions)
 *   router.patch('/orders/:id/approve', authenticate, can('approve_discounts'), handler);
 *
 * Role hierarchy (higher index = more permissions):
 *   salesperson < warehouse < manager < admin
 *
 * IMPORTANT: authenticate() must run before any rbac middleware.
 */

import { send403 } from '../utils/response.js';
import { logger } from '../utils/logger.js';

// ─── Role Hierarchy ───────────────────────────────────────────────────────────
export const ROLES = {
  SALESPERSON: 'salesperson',
  WAREHOUSE: 'warehouse',
  MANAGER: 'manager',
  ADMIN: 'admin',
};

// Numeric rank — higher = more privileged
const ROLE_RANK = {
  salesperson: 1,
  warehouse: 2,
  manager: 3,
  admin: 4,
};

// ─── Permission Map ───────────────────────────────────────────────────────────
// Maps semantic permission names to the roles that hold them.
// Use these in routes for clarity instead of hardcoding role strings.
const PERMISSIONS = {
  // Product management
  manage_products:        [ROLES.ADMIN],
  view_products:          [ROLES.SALESPERSON, ROLES.WAREHOUSE, ROLES.MANAGER, ROLES.ADMIN],

  // Client management
  manage_all_clients:     [ROLES.ADMIN, ROLES.MANAGER],
  manage_own_clients:     [ROLES.SALESPERSON, ROLES.MANAGER, ROLES.ADMIN],

  // Orders
  create_order:           [ROLES.SALESPERSON, ROLES.MANAGER, ROLES.ADMIN],
  view_own_orders:        [ROLES.SALESPERSON, ROLES.MANAGER, ROLES.ADMIN],
  view_team_orders:       [ROLES.MANAGER, ROLES.ADMIN],
  view_all_orders:        [ROLES.ADMIN],
  cancel_order:           [ROLES.MANAGER, ROLES.ADMIN],

  // Warehouse operations
  update_order_fulfilment: [ROLES.WAREHOUSE, ROLES.ADMIN],
  view_warehouse_queue:    [ROLES.WAREHOUSE, ROLES.MANAGER, ROLES.ADMIN],

  // Discounts and approvals
  approve_discounts:      [ROLES.MANAGER, ROLES.ADMIN],
  request_discounts:      [ROLES.SALESPERSON, ROLES.MANAGER, ROLES.ADMIN],

  // Returns
  initiate_return:        [ROLES.SALESPERSON, ROLES.MANAGER, ROLES.ADMIN],
  approve_return:         [ROLES.MANAGER, ROLES.ADMIN],

  // Dashboards
  view_own_dashboard:     [ROLES.SALESPERSON, ROLES.MANAGER, ROLES.ADMIN],
  view_team_dashboard:    [ROLES.MANAGER, ROLES.ADMIN],
  view_admin_dashboard:   [ROLES.ADMIN],

  // User management
  manage_users:           [ROLES.ADMIN],
  view_team_members:      [ROLES.MANAGER, ROLES.ADMIN],

  // Schemes and pricing
  manage_schemes:         [ROLES.ADMIN],
  manage_pricing:         [ROLES.ADMIN],

  // Reports
  export_reports:         [ROLES.MANAGER, ROLES.ADMIN],
};

// ─── authorize() ─────────────────────────────────────────────────────────────

/**
 * Middleware: only allow specific roles.
 *
 * @param {...string} allowedRoles - One or more role strings
 * @returns Express middleware function
 *
 * @example
 *   router.post('/products', authenticate, authorize('admin'), createProduct);
 *   router.get('/dashboard', authenticate, authorize('manager', 'admin'), getDashboard);
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    // authenticate() must have run first and populated req.user
    if (!req.user) {
      logger.warn('authorize() called without req.user — did you forget authenticate()?');
      return send403(res, { error: 'Access denied.' });
    }

    const { role, id } = req.user;

    if (!allowedRoles.includes(role)) {
      logger.warn(`RBAC: User ${id} (${role}) attempted access to ${req.method} ${req.originalUrl} — requires [${allowedRoles.join(', ')}]`);
      return send403(res, { error: `Access denied. Required role: ${allowedRoles.join(' or ')}.` });
    }

    next();
  };
}

// ─── authorizeMinRole() ───────────────────────────────────────────────────────

/**
 * Middleware: allow a role AND all roles above it in the hierarchy.
 * E.g., authorizeMinRole('manager') allows manager AND admin.
 *
 * @param {string} minRole - Minimum required role
 * @returns Express middleware function
 *
 * @example
 *   router.get('/team', authenticate, authorizeMinRole('manager'), getTeam);
 */
export function authorizeMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return send403(res, { error: 'Access denied.' });
    }

    const userRank = ROLE_RANK[req.user.role] ?? 0;
    const requiredRank = ROLE_RANK[minRole] ?? 99;

    if (userRank < requiredRank) {
      logger.warn(`RBAC: User ${req.user.id} (${req.user.role}) insufficient rank for ${req.method} ${req.originalUrl}`);
      return send403(res, { error: `Access denied. Minimum role required: ${minRole}.` });
    }

    next();
  };
}

// ─── can() ───────────────────────────────────────────────────────────────────

/**
 * Middleware: check a named semantic permission.
 * More readable than listing role names in route definitions.
 *
 * @param {string} permission - Key from PERMISSIONS map
 * @returns Express middleware function
 *
 * @example
 *   router.patch('/orders/:id/discount', authenticate, can('approve_discounts'), handler);
 */
export function can(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return send403(res, { error: 'Access denied.' });
    }

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      logger.error(`RBAC: Unknown permission '${permission}' checked in ${req.method} ${req.originalUrl}`);
      return send403(res, { error: 'Access denied.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`RBAC: User ${req.user.id} (${req.user.role}) lacks permission '${permission}'`);
      return send403(res, { error: 'You do not have permission to perform this action.' });
    }

    next();
  };
}

// ─── Self-only guard ──────────────────────────────────────────────────────────

/**
 * Middleware: ensures the authenticated user is accessing their own resource.
 * Admins bypass this check.
 *
 * @param {Function} getResourceOwnerId - Receives req and returns the resource owner's user ID
 * @returns Express middleware function
 *
 * @example
 *   // Only allow user to edit their own profile (admin can edit anyone)
 *   router.patch('/users/:id',
 *     authenticate,
 *     isSelfOrAdmin((req) => req.params.id),
 *     updateUser
 *   );
 */
export function isSelfOrAdmin(getResourceOwnerId) {
  return (req, res, next) => {
    if (!req.user) {
      return send403(res, { error: 'Access denied.' });
    }

    // Admin bypasses self-check
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const resourceOwnerId = getResourceOwnerId(req);
    if (req.user.id !== resourceOwnerId) {
      return send403(res, { error: 'You can only access your own resources.' });
    }

    next();
  };
}
