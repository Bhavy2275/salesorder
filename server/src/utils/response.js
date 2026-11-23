/**
 * response.js — Standardised API Response Helpers
 *
 * All API responses follow this envelope:
 * {
 *   success: boolean,
 *   data: any | null,       // Present on success
 *   error: string | null,   // Present on failure
 *   message: string,        // Human-readable status message
 *   meta: object            // Optional: pagination, timestamps, etc.
 * }
 */

/**
 * Send a successful response
 * @param {import('express').Response} res
 * @param {object} options
 */
export function sendSuccess(res, { data = null, message = 'Success', statusCode = 200, meta = {} } = {}) {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
    message,
    ...(Object.keys(meta).length > 0 && { meta }),
  });
}

/**
 * Send an error response
 * @param {import('express').Response} res
 * @param {object} options
 */
export function sendError(res, { error = 'An error occurred', message = null, statusCode = 500, details = null } = {}) {
  // Shorthand helpers are used throughout the routes as both send400(res,
  // 'Bad input') and send400(res, { error: 'Bad input', details }). Accept
  // either form, and never put an object in the user-facing `error` field.
  if (error && typeof error === 'object') {
    const wrapped = error;
    message = message || (typeof wrapped.message === 'string' ? wrapped.message : null);
    details = details || wrapped.details || (wrapped.error && typeof wrapped.error === 'object' ? wrapped.error : null);
    error = typeof wrapped.error === 'string'
      ? wrapped.error
      : typeof wrapped.message === 'string'
        ? wrapped.message
        : 'Request validation failed';
  }

  if (typeof error !== 'string') error = String(error ?? 'An error occurred');

  const body = {
    success: false,
    data: null,
    error,
    message: message || error,
  };

  // Include validation details in dev mode only
  if (details && process.env.NODE_ENV !== 'production') {
    body.details = details;
  }

  return res.status(statusCode).json(body);
}

// ─── Shorthand helpers ────────────────────────────────────────────────────────

export const send400 = (res, error = 'Bad request') =>
  sendError(res, { error, statusCode: 400 });

export const send401 = (res, error = 'Unauthorised') =>
  sendError(res, { error, statusCode: 401 });

export const send403 = (res, error = 'Forbidden') =>
  sendError(res, { error, statusCode: 403 });

export const send404 = (res, error = 'Not found') =>
  sendError(res, { error, statusCode: 404 });

export const send409 = (res, error = 'Conflict') =>
  sendError(res, { error, statusCode: 409 });

export const send422 = (res, error = 'Unprocessable entity', details = null) =>
  sendError(res, { error, statusCode: 422, details });

export const send429 = (res, error = 'Too many requests') =>
  sendError(res, { error, statusCode: 429 });

export const send500 = (res, error = 'Internal server error') =>
  sendError(res, { error, statusCode: 500 });
