/**
 * warehouse.controller.js — Warehouse Fulfilment Logic
 */

import { supabaseAdmin } from '../config/db.js';
import redis from '../config/redis.js';
import { logger } from '../utils/logger.js';

const QUEUE_CACHE_TTL = 15; // 15 seconds — warehouse queue needs near-real-time freshness
const STATS_CACHE_TTL = 60; // 1 minute

// ─── GET QUEUE ────────────────────────────────────────────────────────────────

export async function getWarehouseQueue(filters = {}) {
  const {
    status,           // Filter by specific status or 'all'
    search,           // Search by order, party, GST number, item or salesperson
    sort = 'priority',
    page = 1,
    limit = 30,
  } = filters;

  const offset = (page - 1) * limit;
  const cacheKey = `warehouse:queue:${JSON.stringify(filters)}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  let query = supabaseAdmin
    .from('warehouse_fulfilment_queue')
    .select('*', { count: 'exact' });

  // Status filter (default: show all active statuses)
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  // Search
  if (search?.trim()) {
    query = query.or([
      `order_number.ilike.%${search}%`,
      `client_name.ilike.%${search}%`,
      `client_gst.ilike.%${search}%`,
      `item_names.ilike.%${search}%`,
      `salesperson_name.ilike.%${search}%`,
    ].join(','));
  }

  // Sort
  switch (sort) {
    case 'priority':
      query = query
        .order('is_overdue', { ascending: false })
        .order('delivery_date', { ascending: true, nullsFirst: false })
        .order('placed_at', { ascending: true });
      break;
    case 'newest':
      query = query.order('placed_at', { ascending: false });
      break;
    case 'total_desc':
      query = query.order('grand_total', { ascending: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) { logger.error('getWarehouseQueue error:', error); throw error; }

  const result = {
    orders: data || [],
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      hasNext: offset + limit < (count || 0),
    },
  };

  await redis.setex(cacheKey, QUEUE_CACHE_TTL, JSON.stringify(result));
  return result;
}

// ─── GET ORDER FULFILMENT DETAIL ─────────────────────────────────────────────

export async function getOrderFulfilmentDetail(orderId) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id, order_number, status, grand_total, payment_terms,
      delivery_date, notes, warehouse_notes, delivery_proof_url,
      placed_at, picking_started_at, packed_at, dispatched_at, delivered_at,
      client:client_id (
        id, business_name, contact_person, mobile_primary, gst_number,
        delivery_address, geo_lat, geo_lng
      ),
      salesperson:salesperson_id (id, name, mobile, employee_code),
      items:order_items (
        id, product_name, sku_code, quantity, unit,
        unit_price, gst_percent, line_total, free_qty, scheme_name,
        product:product_id (id, images, barcode)
      )
    `)
    .eq('id', orderId)
    .single();

  if (error || !data) {
    throw Object.assign(new Error('Order not found.'), { statusCode: 404 });
  }

  return data;
}

// ─── TRANSITION ORDER STATUS ──────────────────────────────────────────────────

export async function transitionOrderStatus(orderId, newStatus, updatedBy, { proofUrl, notes } = {}) {
  const { data, error } = await supabaseAdmin.rpc('transition_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_updated_by: updatedBy,
    p_proof_url: proofUrl || null,
    p_notes: notes || null,
  });

  if (error) {
    logger.error('transitionOrderStatus RPC error:', error);
    // Parse Postgres error message for clean client-facing message
    const msg = error.message?.match(/RAISE EXCEPTION '(.+)'/)?.[1] || error.message;
    throw Object.assign(new Error(msg), { statusCode: 400 });
  }

  // If dispatched → release reserved stock / confirm stock sale
  if (newStatus === 'dispatched') {
    await confirmStockSaleForOrder(orderId);
  }

  // Invalidate queue cache
  await invalidateQueueCache();

  logger.info(`Order ${orderId} → ${newStatus} by ${updatedBy}`);
  return data;
}

// ─── GET DAILY STATS ─────────────────────────────────────────────────────────

export async function getWarehouseDailyStats() {
  const cacheKey = 'warehouse:stats:daily';
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const { data, error } = await supabaseAdmin.rpc('get_warehouse_daily_stats');

  if (error) { logger.error('getWarehouseDailyStats error:', error); throw error; }

  const stats = data?.[0] || {};
  await redis.setex(cacheKey, STATS_CACHE_TTL, JSON.stringify(stats));
  return stats;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function confirmStockSaleForOrder(orderId) {
  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId);

  for (const item of items || []) {
    await supabaseAdmin.rpc('confirm_stock_sale', {
      p_product_id: item.product_id,
      p_quantity: item.quantity,
    });
  }
}

async function invalidateQueueCache() {
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'warehouse:queue:*', 'COUNT', 50);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
    await redis.del('warehouse:stats:daily');
  } catch (err) {
    logger.error('invalidateQueueCache error:', err);
  }
}
