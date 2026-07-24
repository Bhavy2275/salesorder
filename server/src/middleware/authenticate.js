/**
 * authenticate.js — JWT Authentication Middleware
 *
 * Verifies the access token from the Authorization header.
 * Attaches decoded user info to req.user for downstream use.
 *
 * Usage:
 *   router.get('/protected', authenticate, (req, res) => {
 *     console.log(req.user.id, req.user.role);
 *   });
 *
 * Token must be passed as: Authorization: Bearer <token>
 */

import { verifyAccessToken, tokenRemainingTTL } from '../utils/jwt.js';
import redis, { RedisKeys } from '../config/redis.js';
import { send401 } from '../utils/response.js';
import { logger } from '../utils/logger.js';

/**
 * Authentication middleware.
 * Validates access token and populates req.user.
 */
export async function authenticate(req, res, next) {
  try {
    // ── 1. Extract token from header ─────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return send401(res, { error: 'Access token required' });
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    // ── 2. Verify JWT signature and expiry ───────────────────────────────────
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return send401(res, { error: 'Access token expired. Please refresh.' });
      }
      if (err.name === 'JsonWebTokenError') {
        return send401(res, { error: 'Invalid access token.' });
      }
      throw err; // Re-throw unexpected errors
    }

    // ── 3. Check token blacklist (for logged-out tokens) ─────────────────────
    // This handles the case where a user logs out but their token hasn't expired yet
    const isBlacklisted = await redis.exists(RedisKeys.blacklist(decoded.jti));
    if (isBlacklisted) {
      return send401(res, { error: 'Token has been revoked. Please log in again.' });
    }

    // ── 4. Attach user context to request ────────────────────────────────────
    // Downstream middleware and route handlers use req.user
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      name: decoded.name,
      jti: decoded.jti,          // Needed for logout (blacklisting)
      tokenExp: decoded.exp,
    };

    // ── 5. Warn if token is about to expire (< 2 min remaining) ─────────────
    // Frontend can check the X-Token-Expires-In header to proactively refresh
    const remainingSeconds = tokenRemainingTTL(decoded);
    res.setHeader('X-Token-Expires-In', remainingSeconds);

    next();
  } catch (err) {
    logger.error('authenticate middleware error:', err);
    return send401(res, { error: 'Authentication failed. Please log in again.' });
  }
}

/**
 * Optional authentication middleware.
 * Populates req.user if a valid token is present, but does NOT block unauthenticated requests.
 * Use for routes that have different behavior for authenticated vs anonymous users.
 */
export async function authenticateOptional(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = authHeader.slice(7);
    const decoded = verifyAccessToken(token);
    const isBlacklisted = await redis.exists(RedisKeys.blacklist(decoded.jti));

    req.user = isBlacklisted ? null : {
      id: decoded.sub,
      role: decoded.role,
      name: decoded.name,
      jti: decoded.jti,
    };
  } catch {
    req.user = null;
  }

  next();
}
