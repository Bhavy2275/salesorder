/**
 * pdf.controller.js — PDF generation controller
 *
 * Handles:
 * 1. Generating a fresh PDF on demand
 * 2. Returning the signed URL for an existing PDF
 * 3. Streaming the HTML preview (dev only)
 * 4. Triggering generation on order confirmation (called from verifyOrderOTP)
 */

import { supabaseAdmin } from '../config/db.js';
import {
  generateOrderPDF,
  generateSignedDownloadUrl,
} from '../services/pdf.service.js';
import { logger } from '../utils/logger.js';

// ─── Full order fetch for PDF ─────────────────────────────────────────────────
async function fetchOrderForPDF(orderId) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id, order_number, status, grand_total, subtotal, total_gst,
      discount_amount, payment_terms, delivery_date, notes,
      otp_verified_at, placed_at, dispatched_at, delivered_at,
      client:client_id (
        id, business_name, contact_person, mobile_primary, delivery_address
      ),
      salesperson:salesperson_id (id, name, mobile, employee_code),
      items:order_items (
        id, product_name, sku_code, quantity, unit,
        unit_price, gst_percent, gst_amount, discount_amount, line_total,
        free_qty, scheme_name
      )
    `)
    .eq('id', orderId)
    .single();

  if (error || !data) {
    throw Object.assign(new Error('Order not found.'), { statusCode: 404 });
  }
  return data;
}

// ─── Generate or regenerate PDF ───────────────────────────────────────────────

/**
 * Generate PDF for an order. If PDF already exists and forceRegen is false, returns existing.
 *
 * @param {string} orderId
 * @param {boolean} forceRegen - Force regeneration even if URL exists
 * @returns {{ pdfUrl: string, publicId: string | null }}
 */
export async function generateOrFetchOrderPDF(orderId, forceRegen = false) {
  // Check if we already have a PDF URL stored
  if (!forceRegen) {
    const { data: existingOrder } = await supabaseAdmin
      .from('orders')
      .select('pdf_url, pdf_public_id, order_number')
      .eq('id', orderId)
      .single();

    if (existingOrder?.pdf_url) {
      logger.info(`Returning existing PDF for order ${existingOrder.order_number}`);
      return {
        pdfUrl: existingOrder.pdf_url,
        publicId: existingOrder.pdf_public_id,
        generated: false,
      };
    }
  }

  // Generate fresh PDF
  const order = await fetchOrderForPDF(orderId);
  const { pdfUrl, publicId } = await generateOrderPDF(order);

  // Persist URL back to order
  await supabaseAdmin
    .from('orders')
    .update({ pdf_url: pdfUrl, pdf_public_id: publicId })
    .eq('id', orderId);

  return { pdfUrl, publicId, generated: true };
}

// ─── Get signed download URL ──────────────────────────────────────────────────

/**
 * Generate a fresh 24-hour signed URL for an existing PDF.
 * Called when the stored URL might have expired.
 */
export async function getSignedPDFUrl(orderId) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('pdf_url, pdf_public_id, order_number')
    .eq('id', orderId)
    .single();

  if (!order?.pdf_public_id) {
    // PDF doesn't exist yet — generate it
    return generateOrFetchOrderPDF(orderId, false);
  }

  const signedUrl = generateSignedDownloadUrl(order.pdf_public_id);
  return { pdfUrl: signedUrl, publicId: order.pdf_public_id, generated: false };
}

// ─── Background generation (called after order confirmation) ─────────────────

/**
 * Fire-and-forget PDF generation after OTP verification.
 * Does NOT block the OTP response — PDF is generated in background.
 *
 * @param {string} orderId
 */
export function generatePDFInBackground(orderId) {
  // Intentionally not awaited
  generateOrFetchOrderPDF(orderId, true)
    .then(({ pdfUrl }) => {
      logger.info(`Background PDF generated for order ${orderId}: ${pdfUrl}`);
    })
    .catch((err) => {
      logger.error(`Background PDF generation failed for order ${orderId}:`, err.message);
    });
}
