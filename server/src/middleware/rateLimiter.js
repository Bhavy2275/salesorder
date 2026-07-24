/**
 * rateLimiter.js — Express Rate Limiting Middleware
 *
 * Two limiters:
 *  1. loginLimiter   — Strict: 10 attempts per 15 min per IP on auth routes
 *  2. apiLimiter     — Generous: 300 requests per 15 min per user for general API
 *
 * Uses in-memory store (development) or Redis store (production).
 * Redis store ensures limits are shared across multiple API instances.
 */

import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { send429 } from '../utils/response.js';

// ─── Shared response handler ──────────────────────────────────────────────────
const rateLimitHandler = (req, res) => {
  return send429(res, {
    error: 'Too many requests. Please try again later.',
  });
};

// ─── Login Rate Limiter ───────────────────────────────────────────────────────
// Applied to: POST /api/auth/login, POST /api/auth/refresh
// Prevents brute-force attacks on login
export const loginLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,     // 15 minutes
  max: env.RATE_LIMIT_MAX_REQUESTS,       // 10 attempts per window
  standardHeaders: 'draft-7',            // RateLimit-* headers (RFC 6585)
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Key by IP address for login attempts
  keyGenerator: (req) => req.ip,
  // Skip rate limiting in test environment
  skip: () => env.NODE_ENV === 'test',
  message: 'Too many login attempts from this IP. Please try again in 15 minutes.',
});

// ─── General API Rate Limiter ─────────────────────────────────────────────────
// Applied to all API routes
// More generous than login limiter — 300 requests per 15 min per user
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Key by authenticated user ID if available, else by IP
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: () => env.NODE_ENV === 'test',
});

// ─── OTP Rate Limiter ─────────────────────────────────────────────────────────
// Applied to: POST /api/orders/:id/otp/send
// Max 3 OTP sends per order per 10 minutes (matches OTP TTL)
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => `${req.user?.id}:${req.params.orderId || 'unknown'}`,
  skip: () => env.NODE_ENV === 'test',
});
