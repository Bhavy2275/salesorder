/**
 * dashboard.controller.js — Sales Analytics Business Logic
 */

import { supabaseAdmin } from '../config/db.js';
import redis from '../config/redis.js';
import { logger } from '../utils/logger.js';

const CACHE_TTL = 5 * 60; // 5 minutes — analytics can tolerate slight staleness

function cacheKey(fn, params) {
  return `dashboard:${fn}:${JSON.stringify(params)}`;
}

async function cachedRpc(fnName, params) {
  const key = cacheKey(fnName, params);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const { data, error } = await supabaseAdmin.rpc(fnName, params);
  if (error) { logger.error(`${fnName} error:`, error); throw error; }

  await redis.setex(key, CACHE_TTL, JSON.stringify(data));
  return data;
}

export const getKPIs = (days) =>
  cachedRpc('get_dashboard_kpis', { p_days: days });

export const getRevenueTrend = (days, teamId) =>
  cachedRpc('get_revenue_trend', { p_days: days, p_team_id: teamId || null });

export const getSalespersonPerformance = (days, limit) =>
  cachedRpc('get_salesperson_performance', { p_days: days, p_limit: limit });

export const getTopProducts = (days, limit, sortBy) =>
  cachedRpc('get_top_products', { p_days: days, p_limit: limit, p_sort_by: sortBy });

export const getOrderStatusSummary = (days) =>
  cachedRpc('get_order_status_summary', { p_days: days });
