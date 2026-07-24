/**
 * products.routes.js — Product Catalogue API
 *
 * Public (authenticated) routes:
 *   GET  /api/products            — List products (search, filter, paginate)
 *   GET  /api/products/:id        — Single product detail
 *   GET  /api/categories          — All categories (hierarchical tree)
 *   GET  /api/brands              — All brands
 *
 * Admin-only routes:
 *   POST   /api/products          — Create product
 *   PATCH  /api/products/:id      — Update product (partial)
 *   DELETE /api/products/:id      — Soft delete product
 *   PATCH  /api/products/:id/stock — Adjust stock quantity
 */

import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { authorize, can } from '../middleware/rbac.js';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  listCategories,
  listBrands,
} from '../controllers/products.controller.js';
import { sendSuccess, send400, send404, send500 } from '../utils/response.js';

const router = express.Router();

// All product routes require authentication
router.use(authenticate);

// ─── Validation Schemas ───────────────────────────────────────────────────────

const productBaseSchema = z.object({
  name: z.string().min(1).max(255),
  sku_code: z.string().min(1).max(100),
  barcode: z.string().max(100).optional(),
  category_id: z.string().uuid().optional(),
  brand_id: z.string().uuid().optional(),
  description: z.string().optional(),
  images: z.array(z.string().url()).optional().default([]),
  pack_size: z.string().max(50).optional(),
  unit: z.string().max(30).default('piece'),
  mrp: z.coerce.number().positive(),
  retailer_price: z.coerce.number().positive(),
  distributor_price: z.coerce.number().positive().optional(),
  wholesale_price: z.coerce.number().positive().optional(),
  vip_price: z.coerce.number().positive().optional(),
  gst_percent: z.coerce.number().min(0).max(28).default(0),
  stock_qty: z.coerce.number().int().min(0).default(0),
  low_stock_threshold: z.coerce.number().int().min(0).default(10),
  allow_backorder: z.boolean().default(false),
  scheme_id: z.string().uuid().optional(),
  is_active: z.boolean().default(true),
});

const createProductSchema = productBaseSchema.refine(
  (d) => d.retailer_price <= d.mrp,
  { message: 'Retailer price cannot exceed MRP', path: ['retailer_price'] }
);

const updateProductSchema = productBaseSchema.partial();

const stockAdjustSchema = z.object({
  delta: z.coerce.number().int().refine((v) => v !== 0, 'Delta cannot be zero'),
  reason: z.enum(['manual', 'sale', 'return', 'adjustment']).default('manual'),
});

const listQuerySchema = z.object({
  q: z.string().optional(),
  category_id: z.string().uuid().optional(),
  brand_id: z.string().uuid().optional(),
  min_price: z.coerce.number().positive().optional(),
  max_price: z.coerce.number().positive().optional(),
  in_stock: z.enum(['true', 'false']).optional(),
  has_scheme: z.enum(['true', 'false']).optional(),
  price_tier: z.enum(['retailer', 'distributor', 'wholesale', 'vip']).optional(),
  sort: z.enum(['name_asc', 'name_desc', 'price_asc', 'price_desc', 'stock_asc', 'stock_desc', 'newest']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ═══════════════════════════════════════════════
// GET /api/products
// ═══════════════════════════════════════════════
router.get('/', async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return send400(res, { error: parsed.error.flatten().fieldErrors });
    }

    // Use caller's assigned price tier as default (salesperson sees their tier)
    const filters = {
      ...parsed.data,
      // Price tier from query param overrides user's default (manager/admin can switch)
      price_tier: parsed.data.price_tier || req.user.defaultPriceTier || 'retailer',
    };

    const result = await listProducts(filters);

    return sendSuccess(res, {
      data: result.products,
      meta: result.pagination,
      message: `Found ${result.pagination.total} products`,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// GET /api/products/:id
// ═══════════════════════════════════════════════
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return send400(res, { error: 'Invalid product ID format.' });
    }

    const priceTier = req.query.price_tier || req.user.defaultPriceTier || 'retailer';
    const product = await getProductById(id, priceTier);

    if (!product) {
      return send404(res, { error: 'Product not found.' });
    }

    return sendSuccess(res, { data: product });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// POST /api/products  [ADMIN ONLY]
// ═══════════════════════════════════════════════
router.post('/', can('manage_products'), async (req, res, next) => {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return send400(res, { error: parsed.error.flatten().fieldErrors });
    }

    const product = await createProduct(parsed.data, req.user.id);

    return sendSuccess(res, {
      data: product,
      message: 'Product created successfully.',
      statusCode: 201,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// PATCH /api/products/:id  [ADMIN ONLY]
// ═══════════════════════════════════════════════
router.patch('/:id', can('manage_products'), async (req, res, next) => {
  try {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return send400(res, { error: parsed.error.flatten().fieldErrors });
    }

    const product = await updateProduct(req.params.id, parsed.data, req.user.id);

    if (!product) {
      return send404(res, { error: 'Product not found.' });
    }

    return sendSuccess(res, {
      data: product,
      message: 'Product updated successfully.',
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// DELETE /api/products/:id  [ADMIN ONLY]
// ═══════════════════════════════════════════════
router.delete('/:id', can('manage_products'), async (req, res, next) => {
  try {
    await deleteProduct(req.params.id);
    return sendSuccess(res, { message: 'Product deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// PATCH /api/products/:id/stock  [WAREHOUSE / ADMIN]
// ═══════════════════════════════════════════════
router.patch('/:id/stock', authorize('warehouse', 'admin'), async (req, res, next) => {
  try {
    const parsed = stockAdjustSchema.safeParse(req.body);
    if (!parsed.success) {
      return send400(res, { error: parsed.error.flatten().fieldErrors });
    }

    const { delta, reason } = parsed.data;
    const updated = await adjustStock(req.params.id, delta, reason);

    return sendSuccess(res, {
      data: updated,
      message: `Stock adjusted by ${delta > 0 ? '+' : ''}${delta}.`,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// GET /api/categories
// ═══════════════════════════════════════════════
router.get('/meta/categories', async (req, res, next) => {
  try {
    const categories = await listCategories();
    return sendSuccess(res, { data: categories });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// GET /api/brands
// ═══════════════════════════════════════════════
router.get('/meta/brands', async (req, res, next) => {
  try {
    const brands = await listBrands();
    return sendSuccess(res, { data: brands });
  } catch (err) {
    next(err);
  }
});

export default router;
