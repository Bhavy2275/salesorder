/**
 * dashboard.routes.js — Sales Analytics API
 *
 * All routes require 'view_team_dashboard' or 'view_admin_dashboard' permission.
 *
 * GET /api/dashboard/kpis          ?days=30
 * GET /api/dashboard/revenue-trend  ?days=30&teamId=uuid
 * GET /api/dashboard/team           ?days=30&limit=20
 * GET /api/dashboard/top-products   ?days=30&limit=10&sortBy=revenue
 * GET /api/dashboard/order-status   ?days=30
 */

import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { can } from '../middleware/rbac.js';
import { sendSuccess } from '../utils/response.js';
import {
  getKPIs,
  getRevenueTrend,
  getSalespersonPerformance,
  getTopProducts,
  getOrderStatusSummary,
} from '../controllers/dashboard.controller.js';

const router = express.Router();
router.use(authenticate, can('view_team_dashboard'));

const days = (req) => Math.min(parseInt(req.query.days, 10) || 30, 365);
const limit = (req, def) => Math.min(parseInt(req.query.limit, 10) || def, 50);

router.get('/kpis',          async (req, res, next) => {
  try { return sendSuccess(res, { data: await getKPIs(days(req)) }); }
  catch (e) { next(e); }
});

router.get('/revenue-trend', async (req, res, next) => {
  try { return sendSuccess(res, { data: await getRevenueTrend(days(req), req.query.teamId) }); }
  catch (e) { next(e); }
});

router.get('/team',          async (req, res, next) => {
  try { return sendSuccess(res, { data: await getSalespersonPerformance(days(req), limit(req, 20)) }); }
  catch (e) { next(e); }
});

router.get('/top-products',  async (req, res, next) => {
  try { return sendSuccess(res, { data: await getTopProducts(days(req), limit(req, 10), req.query.sortBy || 'revenue') }); }
  catch (e) { next(e); }
});

router.get('/order-status',  async (req, res, next) => {
  try { return sendSuccess(res, { data: await getOrderStatusSummary(days(req)) }); }
  catch (e) { next(e); }
});

export default router;
