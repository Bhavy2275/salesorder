/**
 * errorHandler.js — Global Express Error Handler
 *
 * Catches errors thrown by async route handlers (via express-async-errors or try/catch).
 * Must be registered LAST in the middleware chain: app.use(errorHandler)
 */

import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';
import { env } from '../config/env.js';

/**
 * 404 handler — for routes that don't exist.
 * Register before errorHandler, after all routes.
 */
export function notFoundHandler(req, res) {
  return sendError(res, {
    error: `Route ${req.method} ${req.originalUrl} not found.`,
    statusCode: 404,
  });
}

/**
 * Global error handler.
 * Express identifies this as an error handler by its 4-parameter signature.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Log full error details on the server (never sent to client in production)
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    body: req.body,
  });

  // ── Handle known error types ──────────────────────────────────────────────

  // Zod validation errors
  if (err.name === 'ZodError') {
    return sendError(res, {
      error: 'Validation failed',
      statusCode: 422,
      details: err.flatten().fieldErrors,
    });
  }

  // Supabase / database constraint violations
  if (err.code === '23505') {
    return sendError(res, {
      error: 'A record with this value already exists.',
      statusCode: 409,
    });
  }

  if (err.code === '23503') {
    return sendError(res, {
      error: 'Referenced record does not exist.',
      statusCode: 400,
    });
  }

  // JWT errors (shouldn't reach here — authenticate.js handles them)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return sendError(res, { error: 'Invalid or expired token.', statusCode: 401 });
  }

  // Default: 500 Internal Server Error
  // In production, never expose raw error messages
  const message = env.NODE_ENV === 'production'
    ? 'An unexpected error occurred. Please try again later.'
    : err.message;

  return sendError(res, {
    error: message,
    statusCode: err.statusCode || 500,
  });
}
