/**
 * orders.routes.js — Order Management API
 *
 * POST  /api/orders                      — Create order (draft)
 * GET   /api/orders                      — List orders (RBAC filtered)
 * GET   /api/orders/:id                  — Order detail
 * POST  /api/orders/:id/otp/send         — Send OTP to client
 * POST  /api/orders/:id/otp/verify       — Verify OTP → confirm order
 * PATCH /api/orders/:id/cancel           — Cancel order
 */

import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { authorize, can } from '../middleware/rbac.js';
import { otpLimiter } from '../middleware/rateLimiter.js';
import {
  createOrder,
  sendOrderOTP,
  verifyOrderOTP,
  cancelOrder,
  getOrderList,
  getOrderDetail,
} from '../controllers/orders.controller.js';
import { sendSuccess, send400, send404 } from '../utils/response.js';

const router = express.Router();
router.use(authenticate);

// ─── Validation Schemas ───────────────────────────────────────────────────────

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().positive(),       // Sent for reference; server re-prices
  gstPercent: z.coerce.number().min(0).max(28),
  schemeId: z.string().uuid().optional().nullable(),
  schemeName: z.string().optional().nullable(),
  freeQty: z.coerce.number().int().min(0).default(0),
  discountAmount: z.coerce.number().min(0).default(0),
});

const createOrderSchema = z.object({
  clientId: z.string().uuid('Valid client ID required'),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  deliveryAddress: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    pincode: z.string().min(4).max(10),
    landmark: z.string().optional(),
  }).optional(),
  deliveryDate: z.string().date().optional().nullable(),
  paymentTerms: z.enum(['cash', 'online', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'credit']).optional(),
  notes: z.string().max(500).optional(),
  localDraftId: z.string().max(100).optional(),
  createdOffline: z.boolean().default(false),
});

const verifyOTPSchema = z.object({
  otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  deviceId: z.string().optional(),
  geo: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
  }).optional(),
});

const cancelSchema = z.object({
  reason: z.string().min(5, 'Please provide a cancellation reason').max(300),
});

// ═══════════════════════════════════════════════
// POST /api/orders — Create order
// ═══════════════════════════════════════════════
router.post('/', can('create_order'), async (req, res, next) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return send400(res, { error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const order = await createOrder(parsed.data, req.user.id);

    return sendSuccess(res, {
      data: order,
      message: `Order ${order.order_number} created. Send OTP to confirm.`,
      statusCode: 201,
    });
  } catch (err) {
    // Surface stock-specific errors clearly to mobile UI
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.code,
      });
    }
    next(err);
  }
});

// ═══════════════════════════════════════════════
// GET /api/orders — List orders
// ═══════════════════════════════════════════════
router.get('/', async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await getOrderList(req.user.id, req.user.role, {
      status,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });

    return sendSuccess(res, {
      data: result.orders,
      meta: result.pagination,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// GET /api/orders/:id — Order detail
// ═══════════════════════════════════════════════
router.get('/:id', async (req, res, next) => {
  try {
    const order = await getOrderDetail(req.params.id, req.user.id, req.user.role);
    return sendSuccess(res, { data: order });
  } catch (err) {
    if (err.statusCode === 404) return send404(res, { error: err.message });
    next(err);
  }
});

// ═══════════════════════════════════════════════
// POST /api/orders/:id/otp/send — Send OTP
// Rate limited: 3 sends per order per 10 minutes
// ═══════════════════════════════════════════════
router.post('/:id/otp/send', can('create_order'), otpLimiter, async (req, res, next) => {
  try {
    const { id: orderId } = req.params;
    const channel = req.body?.channel === 'whatsapp' ? 'whatsapp' : 'sms';

    const result = await sendOrderOTP(orderId, req.user.id, channel);

    return sendSuccess(res, {
      data: result,
      message: `OTP sent to ${result.maskedMobile} via ${result.channel}. Valid for ${result.expiresInSeconds / 60} minutes.`,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
});

// ═══════════════════════════════════════════════
// POST /api/orders/:id/otp/verify — Verify OTP
// ═══════════════════════════════════════════════
router.post('/:id/otp/verify', can('create_order'), async (req, res, next) => {
  try {
    const parsed = verifyOTPSchema.safeParse(req.body);
    if (!parsed.success) {
      return send400(res, { error: parsed.error.flatten().fieldErrors });
    }

    const { otp, deviceId, geo } = parsed.data;

    const auditMeta = {
      deviceId,
      ip: req.ip,
      lat: geo?.lat,
      lng: geo?.lng,
    };

    const order = await verifyOrderOTP(req.params.id, otp, req.user.id, auditMeta);

    return sendSuccess(res, {
      data: order,
      message: `Order ${order.order_number} confirmed! 🎉 Sent to warehouse.`,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.code,
        attemptsLeft: err.attemptsLeft,
      });
    }
    next(err);
  }
});

// ═══════════════════════════════════════════════
// PATCH /api/orders/:id/cancel — Cancel order
// ═══════════════════════════════════════════════
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const parsed = cancelSchema.safeParse(req.body);
    if (!parsed.success) {
      return send400(res, { error: parsed.error.flatten().fieldErrors });
    }

    const result = await cancelOrder(
      req.params.id,
      req.user.id,
      parsed.data.reason,
      req.user.id
    );

    return sendSuccess(res, { data: result, message: 'Order cancelled.' });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
});

export default router;
