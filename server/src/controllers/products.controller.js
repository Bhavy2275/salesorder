/**
 * products.controller.js — Product Catalogue Business Logic
 *
 * Separated from routes for testability and reuse.
 * All DB queries go through the Supabase admin client (server-side, trusted).
 */

import { supabaseAdmin } from '../config/db.js';
import redis from '../config/redis.js';
import { logger } from '../utils/logger.js';

// Cache TTLs
const PRODUCT_LIST_CACHE_TTL = 60;      // 1 minute — balances freshness vs performance
const PRODUCT_DETAIL_CACHE_TTL = 300;   // 5 minutes
const CATEGORY_CACHE_TTL = 3600;        // 1 hour — rarely changes
const BRAND_CACHE_TTL = 3600;

// Cache key builders
const CacheKeys = {
  productList: (params) => `products:list:${JSON.stringify(params)}`,
  productDetail: (id) => `products:detail:${id}`,
  categories: () => `catalogue:categories`,
  brands: () => `catalogue:brands`,
};

// ─── LIST PRODUCTS ────────────────────────────────────────────────────────────

/**
 * Get paginated, filtered, searchable product list.
 *
 * Supported query params:
 *   q             — Full-text search on name + description
 *   category_id   — Filter by category UUID
 *   brand_id      — Filter by brand UUID
 *   min_price     — Minimum retailer_price
 *   max_price     — Maximum retailer_price
 *   in_stock      — 'true' | 'false' — filter by stock availability
 *   has_scheme    — 'true' — only show products with active schemes
 *   price_tier    — 'retailer'|'distributor'|'wholesale'|'vip'
 *   sort          — 'name_asc'|'name_desc'|'price_asc'|'price_desc'|'stock_asc'
 *   page          — Page number (1-indexed, default 1)
 *   limit         — Items per page (default 20, max 100)
 */
export async function listProducts(filters = {}) {
  const {
    q,
    category_id,
    brand_id,
    min_price,
    max_price,
    in_stock,
    has_scheme,
    price_tier = 'retailer',
    sort = 'name_asc',
    page = 1,
    limit = 20,
  } = filters;

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  // Determine which price column to return based on caller's tier
  const priceColumn = {
    retailer: 'retailer_price',
    distributor: 'distributor_price',
    wholesale: 'wholesale_price',
    vip: 'vip_price',
  }[price_tier] || 'retailer_price';

  // Try cache first (only for simple, non-search queries to avoid cache explosion)
  const cacheKey = CacheKeys.productList(filters);
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // ── Build Supabase query ──────────────────────────────────────────────────
  let query = supabaseAdmin
    .from('products')
    .select(`
      id,
      name,
      sku_code,
      barcode,
      description,
      images,
      pack_size,
      unit,
      mrp,
      retailer_price,
      distributor_price,
      wholesale_price,
      vip_price,
      gst_percent,
      stock_qty,
      reserved_qty,
      low_stock_threshold,
      allow_backorder,
      is_active,
      category:category_id (id, name, slug),
      brand:brand_id (id, name, logo_url),
      scheme:scheme_id (
        id, name, scheme_type, ribbon_text,
        buy_quantity, free_quantity,
        discount_percent, discount_flat,
        valid_from, valid_until
      )
    `, { count: 'exact' })
    .is('deleted_at', null)
    .eq('is_active', true);

  // ── Apply filters ─────────────────────────────────────────────────────────

  // Full-text search using Postgres tsvector index
  if (q && q.trim()) {
    // Supabase textSearch uses the pg full-text search
    query = query.textSearch('name', q.trim(), {
      type: 'websearch',
      config: 'english',
    });
  }

  if (category_id) {
    query = query.eq('category_id', category_id);
  }

  if (brand_id) {
    query = query.eq('brand_id', brand_id);
  }

  if (min_price !== undefined) {
    query = query.gte(priceColumn, parseFloat(min_price));
  }

  if (max_price !== undefined) {
    query = query.lte(priceColumn, parseFloat(max_price));
  }

  if (in_stock === 'true') {
    query = query.gt('stock_qty', 0);
  } else if (in_stock === 'false') {
    query = query.eq('stock_qty', 0);
  }

  if (has_scheme === 'true') {
    query = query.not('scheme_id', 'is', null);
  }

  // ── Apply sorting ─────────────────────────────────────────────────────────
  const sortMap = {
    name_asc:   { column: 'name',           ascending: true },
    name_desc:  { column: 'name',           ascending: false },
    price_asc:  { column: priceColumn,      ascending: true },
    price_desc: { column: priceColumn,      ascending: false },
    stock_asc:  { column: 'stock_qty',      ascending: true },
    stock_desc: { column: 'stock_qty',      ascending: false },
    newest:     { column: 'created_at',     ascending: false },
  };

  const { column: sortColumn, ascending } = sortMap[sort] || sortMap.name_asc;
  query = query.order(sortColumn, { ascending });

  // ── Pagination ────────────────────────────────────────────────────────────
  query = query.range(offset, offset + safeLimit - 1);

  const { data, error, count } = await query;

  if (error) {
    logger.error('listProducts DB error:', error);
    throw error;
  }

  // ── Enrich with stock status and effective price ───────────────────────────
  const products = (data || []).map((p) => enrichProduct(p, price_tier));

  const result = {
    products,
    pagination: {
      total: count || 0,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil((count || 0) / safeLimit),
      hasNext: offset + safeLimit < (count || 0),
      hasPrev: safePage > 1,
    },
  };

  // Cache result (skip caching for search queries — too many variations)
  if (!q) {
    await redis.setex(cacheKey, PRODUCT_LIST_CACHE_TTL, JSON.stringify(result));
  }

  return result;
}

// ─── GET SINGLE PRODUCT ───────────────────────────────────────────────────────

export async function getProductById(productId, priceTier = 'retailer') {
  const cacheKey = CacheKeys.productDetail(productId);
  const cached = await redis.get(cacheKey);
  if (cached) {
    const product = JSON.parse(cached);
    return enrichProduct(product, priceTier);
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .select(`
      id, name, sku_code, barcode, description, images,
      pack_size, unit, mrp,
      retailer_price, distributor_price, wholesale_price, vip_price,
      gst_percent, stock_qty, reserved_qty, low_stock_threshold, allow_backorder,
      is_active, created_at, updated_at,
      category:category_id (id, name, slug, parent_id),
      brand:brand_id (id, name, logo_url),
      scheme:scheme_id (
        id, name, scheme_type, description, ribbon_text,
        buy_quantity, free_quantity, discount_percent, discount_flat,
        min_order_value, applicable_tiers, valid_from, valid_until
      )
    `)
    .eq('id', productId)
    .is('deleted_at', null)
    .single();

  if (error || !data) return null;

  // Cache raw (without price-tier enrichment so same cache serves all tiers)
  await redis.setex(cacheKey, PRODUCT_DETAIL_CACHE_TTL, JSON.stringify(data));

  return enrichProduct(data, priceTier);
}

// ─── CREATE PRODUCT (admin only) ──────────────────────────────────────────────

export async function createProduct(payload, createdBy) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({ ...payload, created_by: createdBy })
    .select()
    .single();

  if (error) {
    logger.error('createProduct DB error:', error);
    throw error;
  }

  // Invalidate category-specific list caches
  await invalidateProductCaches();

  return data;
}

// ─── UPDATE PRODUCT (admin only) ─────────────────────────────────────────────

export async function updateProduct(productId, payload, updatedBy) {
  // If pricing fields are changing, log to price_history first
  const hasPriceChange = [
    'mrp', 'retailer_price', 'distributor_price',
    'wholesale_price', 'vip_price', 'gst_percent',
  ].some((f) => payload[f] !== undefined);

  if (hasPriceChange) {
    // Fetch current prices for history log
    const { data: current } = await supabaseAdmin
      .from('products')
      .select('mrp, retailer_price, distributor_price, wholesale_price, vip_price, gst_percent')
      .eq('id', productId)
      .single();

    if (current) {
      await supabaseAdmin.from('product_price_history').insert({
        product_id: productId,
        changed_by: updatedBy,
        mrp_old: current.mrp,
        mrp_new: payload.mrp ?? current.mrp,
        retailer_price_old: current.retailer_price,
        retailer_price_new: payload.retailer_price ?? current.retailer_price,
        distributor_price_old: current.distributor_price,
        distributor_price_new: payload.distributor_price ?? current.distributor_price,
        wholesale_price_old: current.wholesale_price,
        wholesale_price_new: payload.wholesale_price ?? current.wholesale_price,
        vip_price_old: current.vip_price,
        vip_price_new: payload.vip_price ?? current.vip_price,
        gst_percent_old: current.gst_percent,
        gst_percent_new: payload.gst_percent ?? current.gst_percent,
      });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .update(payload)
    .eq('id', productId)
    .select()
    .single();

  if (error) throw error;

  // Invalidate specific product cache
  await redis.del(CacheKeys.productDetail(productId));
  await invalidateProductCaches();

  return data;
}

// ─── ADJUST STOCK (warehouse / admin) ────────────────────────────────────────

/**
 * Adjust product stock by a delta (positive = add, negative = remove).
 * Uses Postgres RPC for atomic update to prevent race conditions.
 *
 * @param {string} productId
 * @param {number} delta - Amount to add (positive) or remove (negative)
 * @param {'manual'|'sale'|'return'|'adjustment'} reason
 */
export async function adjustStock(productId, delta, reason = 'manual') {
  // Use a raw RPC call for atomic increment (avoids read-then-write race)
  const { data, error } = await supabaseAdmin.rpc('adjust_product_stock', {
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason,
  });

  if (error) {
    logger.error('adjustStock RPC error:', error);
    throw error;
  }

  await redis.del(CacheKeys.productDetail(productId));
  await invalidateProductCaches();

  return data;
}

// ─── SOFT DELETE (admin only) ─────────────────────────────────────────────────

export async function deleteProduct(productId) {
  const { error } = await supabaseAdmin
    .from('products')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', productId);

  if (error) throw error;

  await redis.del(CacheKeys.productDetail(productId));
  await invalidateProductCaches();
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

export async function listCategories() {
  const cacheKey = CacheKeys.categories();
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug, parent_id, image_url, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  // Build hierarchical tree structure
  const tree = buildCategoryTree(data || []);

  await redis.setex(cacheKey, CATEGORY_CACHE_TTL, JSON.stringify(tree));
  return tree;
}

// ─── BRANDS ───────────────────────────────────────────────────────────────────

export async function listBrands() {
  const cacheKey = CacheKeys.brands();
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const { data, error } = await supabaseAdmin
    .from('brands')
    .select('id, name, logo_url')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;

  await redis.setex(cacheKey, BRAND_CACHE_TTL, JSON.stringify(data));
  return data;
}

// ═══════════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════════

/**
 * Enrich a product with computed fields:
 * - effective_price (based on caller's price tier)
 * - stock_status ('in_stock' | 'low_stock' | 'out_of_stock')
 * - available_qty (stock_qty - reserved_qty)
 * - scheme validity check
 */
function enrichProduct(product, priceTier = 'retailer') {
  const priceMap = {
    retailer: product.retailer_price,
    distributor: product.distributor_price ?? product.retailer_price,
    wholesale: product.wholesale_price ?? product.retailer_price,
    vip: product.vip_price ?? product.retailer_price,
  };

  const effectivePrice = priceMap[priceTier] || product.retailer_price;
  const availableQty = (product.stock_qty || 0) - (product.reserved_qty || 0);

  let stockStatus;
  if (product.stock_qty <= 0) {
    stockStatus = 'out_of_stock';
  } else if (product.stock_qty <= product.low_stock_threshold) {
    stockStatus = 'low_stock';
  } else {
    stockStatus = 'in_stock';
  }

  // Check if linked scheme is still valid today
  let activeScheme = null;
  if (product.scheme) {
    const today = new Date().toISOString().split('T')[0];
    const schemeValid =
      product.scheme.valid_from <= today &&
      (!product.scheme.valid_until || product.scheme.valid_until >= today);
    if (schemeValid) {
      activeScheme = product.scheme;
    }
  }

  return {
    ...product,
    effective_price: effectivePrice,
    price_tier: priceTier,
    available_qty: availableQty,
    stock_status: stockStatus,
    scheme: activeScheme,  // null if expired, object if active
  };
}

/**
 * Build a hierarchical category tree from a flat array.
 * Top-level categories (parent_id = null) become roots;
 * child categories are nested under their parent.
 */
function buildCategoryTree(categories) {
  const map = {};
  categories.forEach((c) => { map[c.id] = { ...c, children: [] }; });

  const roots = [];
  categories.forEach((c) => {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].children.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });

  return roots;
}

/**
 * Invalidate all product list caches (called after any mutation).
 * Uses Redis SCAN to avoid KEYS command in production.
 */
async function invalidateProductCaches() {
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'products:list:*', 'COUNT', 50);
      cursor = nextCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  } catch (err) {
    logger.error('invalidateProductCaches error:', err);
  }
}
