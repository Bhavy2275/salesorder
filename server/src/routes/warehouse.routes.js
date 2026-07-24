/**
 * warehouse.routes.js — Warehouse Fulfilment API
 *
 * GET  /api/warehouse/queue         — Paginated fulfilment queue
 * GET  /api/warehouse/stats         — Today's KPI stats
 * GET  /api/warehouse/orders/:id    — Full order detail with picking list
 * PATCH /api/warehouse/orders/:id/status — Transition order status
 */

import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { authorize, can } from '../middleware/rbac.js';
import {
  getWarehouseQueue,
  getOrderFulfilmentDetail,
  transitionOrderStatus,
  getWarehouseDailyStats,
} from '../controllers/warehouse.controller.js';
import { sendSuccess, send400, send404 } from '../utils/response.js';

const router = express.Router();

// All warehouse routes require authentication + warehouse or admin/manager role
router.use(authenticate);
router.use(can('view_warehouse_queue'));

const transitionSchema = z.object({
  status: z.enum(['picking', 'packed', 'dispatched', 'delivered', 'cancelled']),
  proofUrl: z.string().url().optional(),
  notes: z.string().max(500).optional(),
});

// ═══════════════════════════════════════════════
// GET /api/warehouse/stats
// ═══════════════════════════════════════════════
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getWarehouseDailyStats();
    return sendSuccess(res, { data: stats });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════
// GET /api/warehouse/queue
// ═══════════════════════════════════════════════
router.get('/queue', async (req, res, next) => {
  try {
    const { status, search, sort, page, limit } = req.query;
    const result = await getWarehouseQueue({
      status,
      search,
      sort,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 30,
    });

    return sendSuccess(res, {
      data: result.orders,
      meta: result.pagination,
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════
// GET /api/warehouse/orders/:id
// ═══════════════════════════════════════════════
router.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await getOrderFulfilmentDetail(req.params.id);
    return sendSuccess(res, { data: order });
  } catch (err) {
    if (err.statusCode === 404) return send404(res, { error: err.message });
    next(err);
  }
});

// ═══════════════════════════════════════════════
// PATCH /api/warehouse/orders/:id/status
// ═══════════════════════════════════════════════
router.patch('/orders/:id/status', can('update_order_fulfilment'), async (req, res, next) => {
  try {
    const parsed = transitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return send400(res, { error: parsed.error.flatten().fieldErrors });
    }

    const { status, proofUrl, notes } = parsed.data;

    const order = await transitionOrderStatus(
      req.params.id,
      status,
      req.user.id,
      { proofUrl, notes }
    );

    return sendSuccess(res, {
      data: order,
      message: `Order moved to '${status}'.`,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
});

export default router;
