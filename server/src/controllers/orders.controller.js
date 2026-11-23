/**
 * orders.controller.js — Order Lifecycle Business Logic
 *
 * Responsibilities:
 *  - Create draft order with reserved stock
 *  - Send OTP to client mobile
 *  - Verify OTP and transition order to 'placed'
 *  - Cancel order and release stock reservations
 *  - Fetch order list and detail
 *
 * Stock lifecycle:
 *  draft created    → reserve_stock() called per item
 *  OTP verified     → status = 'placed' (stock still reserved)
 *  dispatched       → confirm_stock_sale() called (stock_qty reduced)
 *  cancelled        → release_stock_reservation() called
 */

import { supabaseAdmin } from '../config/db.js';
import { logger } from '../utils/logger.js';
import {
  generateAndStoreOTP,
  sendOTP,
  verifyOTP,
} from '../services/otp.service.js';
import { generatePDFInBackground } from './pdf.controller.js';

// ─── CREATE ORDER ─────────────────────────────────────────────────────────────

/**
 * Create a new order in 'draft' status and reserve stock.
 * Called when salesperson taps "Proceed" on Step 1 of checkout.
 *
 * @param {object} payload - Validated order data
 * @param {string} salespersonId
 * @returns {object} Created order
 */
export async function createOrder(payload, salespersonId) {
  const {
    clientId,
    items,            // [{ productId, quantity, unitPrice, gstPercent, schemeId, schemeName, freeQty }]
    deliveryAddress,
    deliveryDate,
    paymentTerms,
    notes,
    localDraftId,     // WatermelonDB local ID for dedup
    createdOffline,
    managerId,
  } = payload;

  // ── 1. Deduplicate offline-created drafts ─────────────────────────────────
  // If the same draft was synced multiple times (poor connectivity), don't create duplicates
  if (localDraftId) {
    const { data: existing } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status')
      .eq('local_draft_id', localDraftId)
      .eq('salesperson_id', salespersonId)
      .single();

    if (existing) {
      logger.info(`Duplicate draft detected (local_draft_id: ${localDraftId}). Returning existing.`);
      return existing;
    }
  }

  // ── 2. Verify client exists and is assigned to this salesperson ───────────
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id, business_name, mobile_primary, delivery_address, payment_terms, price_tier, assigned_salesperson_id')
    .eq('id', clientId)
    .is('deleted_at', null)
    .single();

  if (clientError || !client) {
    throw Object.assign(new Error('Client not found.'), { statusCode: 404 });
  }

  if (client.assigned_salesperson_id !== salespersonId) {
    throw Object.assign(new Error('This client is not assigned to your account.'), { statusCode: 403 });
  }

  // ── 3. Validate and price each item ───────────────────────────────────────
  const productIds = items.map((i) => i.productId);
  const { data: products, error: prodError } = await supabaseAdmin
    .from('products')
    .select('id, name, sku_code, stock_qty, reserved_qty, allow_backorder, retailer_price, distributor_price, wholesale_price, vip_price, gst_percent, unit')
    .in('id', productIds)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (prodError) throw prodError;

  const productMap = Object.fromEntries((products || []).map((p) => [p.id, p]));

  // Validate stock availability for each item
  const enrichedItems = [];
  for (const item of items) {
    const product = productMap[item.productId];
    if (!product) {
      throw Object.assign(
        new Error(`Product ${item.productId} not found or inactive.`),
        { statusCode: 400 }
      );
    }

    const available = product.stock_qty - product.reserved_qty;
    if (!product.allow_backorder && available < item.quantity) {
      throw Object.assign(
        new Error(`Insufficient stock for "${product.name}". Available: ${available}, Requested: ${item.quantity}`),
        { statusCode: 409 }
      );
    }

    // Use server-side prices (never trust client-sent prices)
    const priceKey = {
      retailer: 'retailer_price',
      distributor: 'distributor_price',
      wholesale: 'wholesale_price',
      vip: 'vip_price',
    }[client.price_tier] || 'retailer_price';

    const unitPrice = product[priceKey] || product.retailer_price;
    const gstAmount = (unitPrice * item.quantity * product.gst_percent) / 100;
    const lineTotal = (unitPrice * item.quantity) + gstAmount - (item.discountAmount || 0);

    enrichedItems.push({
      product_id: item.productId,
      product_name: product.name,
      sku_code: product.sku_code,
      quantity: item.quantity,
      unit: product.unit,
      unit_price: unitPrice,
      gst_percent: product.gst_percent,
      gst_amount: Math.round(gstAmount * 100) / 100,
      discount_amount: item.discountAmount || 0,
      line_total: Math.round(lineTotal * 100) / 100,
      scheme_id: item.schemeId || null,
      scheme_name: item.schemeName || null,
      free_qty: item.freeQty || 0,
    });
  }

  // ── 4. Compute order totals ────────────────────────────────────────────────
  const subtotal = enrichedItems.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
  const totalGst = enrichedItems.reduce((s, i) => s + i.gst_amount, 0);
  const discountAmount = enrichedItems.reduce((s, i) => s + i.discount_amount, 0);
  const grandTotal = subtotal + totalGst - discountAmount;

  // ── 5. Create order + items in a single transaction ───────────────────────
  // Supabase doesn't expose raw transactions via JS client,
  // so we use a DB function for atomicity
  const { data: order, error: orderError } = await supabaseAdmin
    .rpc('create_order_with_items', {
      p_salesperson_id: salespersonId,
      p_client_id: clientId,
      p_manager_id: managerId || null,
      p_delivery_address: deliveryAddress || client.delivery_address,
      p_delivery_date: deliveryDate || null,
      p_payment_terms: paymentTerms || client.payment_terms,
      p_notes: notes || null,
      p_local_draft_id: localDraftId || null,
      p_created_offline: createdOffline || false,
      p_subtotal: Math.round(subtotal * 100) / 100,
      p_total_gst: Math.round(totalGst * 100) / 100,
      p_discount_amount: Math.round(discountAmount * 100) / 100,
      p_grand_total: Math.round(grandTotal * 100) / 100,
      p_otp_sent_to: client.mobile_primary,
      p_items: enrichedItems,
    });

  if (orderError) {
    logger.error('create_order_with_items RPC error:', orderError);
    throw orderError;
  }

  logger.info(`Order ${order.order_number} created for client ${client.business_name}`);
  return order;
}

// ─── SEND OTP ─────────────────────────────────────────────────────────────────

/**
 * Generate and send OTP to the client's mobile.
 * Can be called multiple times (resend flow) with rate limiting enforced at route level.
 *
 * @param {string} orderId
 * @param {string} salespersonId - Must own this order
 * @param {string} channel - 'sms' | 'whatsapp'
 * @returns {object} { sentTo, channel, expiresInSeconds }
 */
export async function sendOrderOTP(orderId, salespersonId, channel = 'sms') {
  // ── 1. Fetch order and verify ownership ───────────────────────────────────
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, status, otp_sent_to, client:client_id(mobile_primary, business_name)')
    .eq('id', orderId)
    .eq('salesperson_id', salespersonId) // RBAC: salesperson can only OTP their own orders
    .single();

  if (error || !order) {
    throw Object.assign(new Error('Order not found.'), { statusCode: 404 });
  }

  // Only allow OTP for orders in draft or placed (resend) state
  if (!['draft', 'placed'].includes(order.status)) {
    throw Object.assign(
      new Error(`Cannot send OTP for order in '${order.status}' status.`),
      { statusCode: 400 }
    );
  }

  const mobile = order.otp_sent_to || order.client?.mobile_primary;
  if (!mobile) {
    throw Object.assign(new Error('No mobile number found for this client.'), { statusCode: 400 });
  }

  // ── 2. Generate OTP and store in Redis ────────────────────────────────────
  const otp = await generateAndStoreOTP(orderId, mobile);

  // ── 3. Send OTP via SMS/WhatsApp ──────────────────────────────────────────
  const { channel: sentChannel, messageId } = await sendOTP(mobile, otp, channel);

  logger.info(`OTP sent for order ${order.order_number} to ${mobile.slice(-4).padStart(mobile.length, '*')} via ${sentChannel}`);

  return {
    sentTo: mobile,
    maskedMobile: `${mobile.slice(0, 2)}******${mobile.slice(-2)}`,
    channel: sentChannel,
    expiresInSeconds: parseInt(process.env.OTP_TTL_SECONDS || '600', 10),
    messageId,
  };
}

// ─── VERIFY OTP & CONFIRM ORDER ───────────────────────────────────────────────

/**
 * Verify OTP and transition order from 'draft' → 'placed'.
 * This is the critical confirmation step — order becomes visible to warehouse.
 *
 * @param {string} orderId
 * @param {string} submittedOtp - 6-digit code from client
 * @param {string} salespersonId
 * @param {object} auditMeta - Device/location info for audit log
 * @returns {object} Updated order
 */
export async function verifyOrderOTP(orderId, submittedOtp, salespersonId, auditMeta = {}) {
  // ── 1. Fetch order ────────────────────────────────────────────────────────
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, status, otp_sent_to, client_id, otp_verified')
    .eq('id', orderId)
    .eq('salesperson_id', salespersonId)
    .single();

  if (error || !order) {
    throw Object.assign(new Error('Order not found.'), { statusCode: 404 });
  }

  if (order.otp_verified) {
    throw Object.assign(new Error('Order is already confirmed.'), { statusCode: 400 });
  }

  if (!['draft', 'placed'].includes(order.status)) {
    throw Object.assign(
      new Error(`Cannot verify OTP for order in '${order.status}' status.`),
      { statusCode: 400 }
    );
  }

  // ── 2. Verify OTP ─────────────────────────────────────────────────────────
  const result = await verifyOTP(orderId, submittedOtp, {
    salespersonId,
    clientId: order.client_id,
    mobile: order.otp_sent_to,
    channel: 'sms',
    ...auditMeta,
  });

  if (!result.valid) {
    // Return structured error so mobile can show remaining attempts
    throw Object.assign(new Error(result.reason), {
      statusCode: 400,
      attemptsLeft: result.attemptsLeft,
      code: 'OTP_INVALID',
    });
  }

  // ── 3. Transition order to 'placed' ───────────────────────────────────────
  const now = new Date().toISOString();
  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'placed',
      otp_verified: true,
      otp_verified_at: now,
      placed_at: now,
    })
    .eq('id', orderId)
    .select(`
      id, order_number, status, grand_total, otp_verified_at,
      client:client_id (business_name, mobile_primary),
      salesperson:salesperson_id (name)
    `)
    .single();

  if (updateError) throw updateError;

  logger.info(`Order ${order.order_number} confirmed via OTP.`);

  // Generate PDF in background — does not block response
  generatePDFInBackground(orderId);

  return updatedOrder;
}

// ─── CANCEL ORDER ─────────────────────────────────────────────────────────────

export async function cancelOrder(orderId, salespersonId, reason, cancelledBy) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, status, salesperson_id')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    throw Object.assign(new Error('Order not found.'), { statusCode: 404 });
  }

  // Only salesperson (own orders) or manager/admin can cancel
  const isOwner = order.salesperson_id === salespersonId;
  if (!isOwner) {
    throw Object.assign(new Error('Not authorised to cancel this order.'), { statusCode: 403 });
  }

  // Can only cancel before warehouse starts picking
  if (['picking', 'packed', 'dispatched', 'delivered'].includes(order.status)) {
    throw Object.assign(
      new Error(`Cannot cancel order in '${order.status}' status. Contact warehouse.`),
      { statusCode: 400 }
    );
  }

  if (order.status === 'cancelled') {
    throw Object.assign(new Error('Order is already cancelled.'), { statusCode: 400 });
  }

  // Release stock reservations + update status in one RPC
  const { error: rpcError } = await supabaseAdmin.rpc('cancel_order_and_release_stock', {
    p_order_id: orderId,
    p_reason: reason,
    p_cancelled_by: cancelledBy,
  });

  if (rpcError) throw rpcError;

  logger.info(`Order ${order.order_number} cancelled. Reason: ${reason}`);
  return { orderId, status: 'cancelled' };
}

// ─── GET ORDER LIST ───────────────────────────────────────────────────────────

export async function getOrderList(salespersonId, role, filters = {}) {
  const { status, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('order_summary')   // Use the view from migration 008
    .select('*', { count: 'exact' });

  // RBAC: salesperson sees only their orders
  if (role === 'salesperson') {
    query = query.eq('salesperson_id', salespersonId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    orders: data || [],
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      hasNext: offset + limit < (count || 0),
    },
  };
}

// ─── GET ORDER DETAIL ─────────────────────────────────────────────────────────

export async function getOrderDetail(orderId, salespersonId, role) {
  let query = supabaseAdmin
    .from('orders')
    .select(`
      id, order_number, status, grand_total, subtotal, total_gst,
      discount_amount, payment_terms, delivery_date, notes,
      otp_verified, otp_verified_at, placed_at, dispatched_at, delivered_at,
      cancelled_at, cancel_reason, created_at, pdf_url,
      client:client_id (
        id, business_name, contact_person, mobile_primary,
        billing_address, delivery_address, geo_lat, geo_lng
      ),
      salesperson:salesperson_id (id, name, mobile, employee_code),
      items:order_items (
        id, product_name, sku_code, quantity, unit,
        unit_price, gst_percent, gst_amount, discount_amount,
        line_total, free_qty, scheme_name,
        product:product_id (id, images)
      )
    `)
    .eq('id', orderId);

  if (role === 'salesperson') {
    query = query.eq('salesperson_id', salespersonId);
  }

  const { data, error } = await query.single();
  if (error || !data) throw Object.assign(new Error('Order not found.'), { statusCode: 404 });

  return data;
}
