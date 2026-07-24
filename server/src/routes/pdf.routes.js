/**
 * pdf.routes.js — PDF generation and download endpoints
 *
 * GET  /api/orders/:id/pdf          — Get PDF (generates if missing, returns signed URL)
 * POST /api/orders/:id/pdf/generate — Force regenerate PDF
 * GET  /api/orders/:id/pdf-preview  — Stream HTML preview (dev only)
 */

import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { can } from '../middleware/rbac.js';
import { buildOrderPDF } from '../services/pdf/orderTemplate.js';
import {
  generateOrFetchOrderPDF,
  getSignedPDFUrl,
} from '../controllers/pdf.controller.js';
import { supabaseAdmin } from '../config/db.js';
import { sendSuccess, send404 } from '../utils/response.js';
import { env } from '../config/env.js';

const router = express.Router({ mergeParams: true }); // Inherits :id from parent
router.use(authenticate);

// ═══════════════════════════════════════════════
// GET /api/orders/:id/pdf — Get or generate PDF
// ═══════════════════════════════════════════════
router.get('/', async (req, res, next) => {
  try {
    const { id: orderId } = req.params;

    // RBAC: salesperson can only access their own orders
    if (req.user.role === 'salesperson') {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, salesperson_id')
        .eq('id', orderId)
        .single();

      if (!order || order.salesperson_id !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }
    }

    const result = await getSignedPDFUrl(orderId);

    return sendSuccess(res, {
      data: {
        pdfUrl: result.pdfUrl,
        generated: result.generated,
      },
      message: result.generated ? 'PDF generated.' : 'PDF ready.',
    });
  } catch (err) {
    if (err.statusCode === 404) return send404(res, { error: err.message });
    next(err);
  }
});

// ═══════════════════════════════════════════════
// POST /api/orders/:id/pdf/generate — Force regen
// Manager/admin only
// ═══════════════════════════════════════════════
router.post('/generate', can('view_team_orders'), async (req, res, next) => {
  try {
    const result = await generateOrFetchOrderPDF(req.params.id, true);

    return sendSuccess(res, {
      data: { pdfUrl: result.pdfUrl },
      message: 'PDF regenerated successfully.',
      statusCode: 201,
    });
  } catch (err) {
    if (err.statusCode === 404) return send404(res, { error: err.message });
    next(err);
  }
});

// ═══════════════════════════════════════════════
// GET /api/orders/:id/pdf-preview — Dev HTML preview
// Never expose in production
// ═══════════════════════════════════════════════
router.get('-preview', async (req, res, next) => {
  if (env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found.' });
  }

  try {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select(`
        id, order_number, status, grand_total, subtotal, total_gst,
        discount_amount, payment_terms, delivery_date, notes,
        otp_verified_at, placed_at,
        client:client_id (business_name, contact_person, mobile_primary, delivery_address),
        salesperson:salesperson_id (name, employee_code),
        items:order_items (product_name, sku_code, quantity, unit, unit_price, gst_percent, gst_amount, discount_amount, line_total, free_qty, scheme_name)
      `)
      .eq('id', req.params.id)
      .single();

    if (!order) return res.status(404).send('Order not found');

    const html = buildOrderPDF(order);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

export default router;
