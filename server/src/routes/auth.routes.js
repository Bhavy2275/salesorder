/**
 * auth.routes.js — Authentication Endpoints
 *
 * Routes:
 *   POST   /api/auth/login          - Login with mobile/email + password
 *   POST   /api/auth/refresh        - Rotate refresh token → new access + refresh tokens
 *   POST   /api/auth/logout         - Blacklist current access token, delete refresh token
 *   POST   /api/auth/logout-all     - Invalidate ALL sessions for this user
 *   GET    /api/auth/me             - Get current user profile (authenticated)
 *   PATCH  /api/auth/me/password    - Change own password (authenticated)
 *   POST   /api/auth/forgot-password - Request password reset (sends OTP to mobile)
 *   POST   /api/auth/reset-password  - Reset password using OTP
 */

import express from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/db.js';
import redis, { RedisKeys } from '../config/redis.js';
import { env } from '../config/env.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  decodeToken,
  tokenRemainingTTL,
} from '../utils/jwt.js';
import { hashPassword, verifyPassword, hashToken, verifyToken } from '../utils/hash.js';
import { authenticate } from '../middleware/authenticate.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { sendSuccess, send400, send401, send403, send404, send500 } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ─── Validation Schemas (Zod) ─────────────────────────────────────────────────

const loginSchema = z.object({
  // Accept login by mobile OR email
  identifier: z
    .string()
    .min(1, 'Mobile number or email is required')
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, 'Password is required'),
  // Device info for session tracking
  deviceId: z.string().optional(),
  platform: z.enum(['ios', 'android', 'web']).optional().default('web'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
});

const resetPasswordSchema = z.object({
  mobile: z.string().min(10).max(15),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
});

// ─── Helper: set secure refresh token cookie ─────────────────────────────────
function setRefreshCookie(res, token, expiresAt) {
  res.cookie('refreshToken', token, {
    httpOnly: true,                               // Not accessible via JavaScript
    secure: env.NODE_ENV === 'production',        // HTTPS only in production
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    expires: expiresAt,
    path: '/api/auth',                            // Only sent to auth routes
  });
}

// ─── Helper: clear refresh cookie ────────────────────────────────────────────
function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', { path: '/api/auth' });
}

// ─── Helper: look up user by mobile or email ──────────────────────────────────
async function findUserByIdentifier(identifier) {
  // Determine if identifier is mobile (numeric) or email
  const isMobile = /^\d{10,15}$/.test(identifier);

  const query = supabaseAdmin
    .from('users')
    .select('id, name, mobile, email, password_hash, role, is_active, deleted_at, failed_login_attempts, locked_until, manager_id, territory_id, employee_code')
    .is('deleted_at', null)  // Exclude soft-deleted users
    .limit(1);

  if (isMobile) {
    query.eq('mobile', identifier);
  } else {
    query.eq('email', identifier);
  }

  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

// ─── Helper: increment failed login counter ───────────────────────────────────
async function incrementFailedAttempts(userId) {
  const maxAttempts = env.MAX_FAILED_LOGIN_ATTEMPTS;
  const lockDurationMs = env.ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000;

  // Get current count
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('failed_login_attempts')
    .eq('id', userId)
    .single();

  const newCount = (user?.failed_login_attempts || 0) + 1;

  const updatePayload = { failed_login_attempts: newCount };

  // Lock account if max attempts reached
  if (newCount >= maxAttempts) {
    updatePayload.locked_until = new Date(Date.now() + lockDurationMs).toISOString();
    logger.warn(`Auth: Account ${userId} locked after ${newCount} failed attempts.`);
  }

  await supabaseAdmin.from('users').update(updatePayload).eq('id', userId);
  return newCount;
}

// ─── Helper: reset failed login counter ──────────────────────────────────────
async function resetFailedAttempts(userId) {
  await supabaseAdmin
    .from('users')
    .update({ failed_login_attempts: 0, locked_until: null })
    .eq('id', userId);
}

// ═══════════════════════════════════════════════
// POST /api/auth/login
// ═══════════════════════════════════════════════
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    // ── 1. Validate input ─────────────────────────────────────────────────────
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return send400(res, { error: parsed.error.flatten().fieldErrors });
    }
    const { identifier, password, deviceId, platform } = parsed.data;

    // ── 2. Find user ──────────────────────────────────────────────────────────
    const user = await findUserByIdentifier(identifier);
    if (!user) {
      // Return generic message to prevent user enumeration
      return send401(res, { error: 'Invalid credentials.' });
    }

    // ── 3. Check account status ───────────────────────────────────────────────
    if (!user.is_active) {
      return send403(res, { error: 'Your account has been deactivated. Contact your admin.' });
    }

    // Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const lockedUntil = new Date(user.locked_until);
      const minutesLeft = Math.ceil((lockedUntil - Date.now()) / 60000);
      return send403(res, {
        error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    // ── 4. Verify password ────────────────────────────────────────────────────
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      const attempts = await incrementFailedAttempts(user.id);
      const remaining = env.MAX_FAILED_LOGIN_ATTEMPTS - attempts;
      logger.warn(`Auth: Failed login for ${identifier}. ${remaining} attempts remaining.`);

      return send401(res, {
        error: remaining > 0
          ? `Invalid credentials. ${remaining} attempt(s) remaining before account is locked.`
          : 'Account locked due to too many failed attempts.',
      });
    }

    // ── 5. Successful auth — reset failure counter ────────────────────────────
    await resetFailedAttempts(user.id);

    // ── 6. Generate tokens ────────────────────────────────────────────────────
    const { token: accessToken, jti: accessJti, expiresAt: accessExpiresAt } = generateAccessToken(user);
    const { token: refreshToken, family, expiresAt: refreshExpiresAt } = generateRefreshToken(user.id);

    // ── 7. Store refresh token hash in Redis ──────────────────────────────────
    // Key: rt:{userId}:{family}
    // Value: bcrypt hash of the refresh token
    // TTL: 7 days (matches JWT expiry)
    const refreshTokenHash = await hashToken(refreshToken);
    await redis.setex(
      RedisKeys.refreshToken(user.id, family),
      env.JWT_REFRESH_EXPIRES_SECONDS,
      refreshTokenHash
    );

    // ── 8. Update last_login_at in DB ─────────────────────────────────────────
    await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // ── 9. Set refresh token in HttpOnly cookie (web) ─────────────────────────
    setRefreshCookie(res, refreshToken, refreshExpiresAt);

    logger.info(`Auth: User ${user.id} (${user.role}) logged in from ${req.ip}`);

    // ── 10. Respond ───────────────────────────────────────────────────────────
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Login successful.',
      data: {
        accessToken,
        // Also return refresh token in body for mobile clients (who can't use cookies)
        refreshToken,
        expiresAt: accessExpiresAt.toISOString(),
        user: {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          role: user.role,
          employeeCode: user.employee_code,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// POST /api/auth/refresh
// Rotate refresh token — issues new access + refresh token pair
// ═══════════════════════════════════════════════
router.post('/refresh', loginLimiter, async (req, res, next) => {
  try {
    // Accept refresh token from cookie (web) OR request body (mobile)
    const tokenFromBody = req.body?.refreshToken;
    const tokenFromCookie = req.cookies?.refreshToken;
    const incomingToken = tokenFromCookie || tokenFromBody;

    if (!incomingToken) {
      return send401(res, { error: 'Refresh token required.' });
    }

    // ── 1. Verify JWT signature ───────────────────────────────────────────────
    let decoded;
    try {
      decoded = verifyRefreshToken(incomingToken);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        clearRefreshCookie(res);
        return send401(res, { error: 'Session expired. Please log in again.' });
      }
      return send401(res, { error: 'Invalid refresh token.' });
    }

    const { sub: userId, family } = decoded;

    // ── 2. Look up stored token hash in Redis ─────────────────────────────────
    const storedHash = await redis.get(RedisKeys.refreshToken(userId, family));

    if (!storedHash) {
      // Token family not found — either expired or already rotated
      // This is a potential token reuse attack — invalidate everything for this user
      logger.warn(`Auth: Refresh token reuse detected for user ${userId}. Invalidating all sessions.`);
      // Delete all session families for this user (pattern delete)
      await invalidateAllUserSessions(userId);
      clearRefreshCookie(res);
      return send401(res, { error: 'Session invalid. Please log in again.' });
    }

    // ── 3. Verify hash matches ────────────────────────────────────────────────
    const tokenValid = await verifyToken(incomingToken, storedHash);
    if (!tokenValid) {
      // Hash mismatch — possible tampered token
      await redis.del(RedisKeys.refreshToken(userId, family));
      clearRefreshCookie(res);
      return send401(res, { error: 'Invalid session. Please log in again.' });
    }

    // ── 4. Fetch current user (check they're still active) ───────────────────
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, name, role, is_active, deleted_at')
      .eq('id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !user || !user.is_active) {
      await redis.del(RedisKeys.refreshToken(userId, family));
      clearRefreshCookie(res);
      return send401(res, { error: 'User account not found or deactivated.' });
    }

    // ── 5. Rotate tokens — CRITICAL: delete old, issue new ───────────────────
    // Delete the old refresh token from Redis BEFORE issuing a new one
    await redis.del(RedisKeys.refreshToken(userId, family));

    const { token: newAccessToken, expiresAt: newAccessExpiresAt } = generateAccessToken(user);
    // Keep the same family — rotating within the same session
    const { token: newRefreshToken, family: newFamily, expiresAt: newRefreshExpiresAt } = generateRefreshToken(userId, family);

    // Store new refresh token hash
    const newRefreshHash = await hashToken(newRefreshToken);
    await redis.setex(
      RedisKeys.refreshToken(userId, newFamily),
      env.JWT_REFRESH_EXPIRES_SECONDS,
      newRefreshHash
    );

    // ── 6. Set new cookie and respond ─────────────────────────────────────────
    setRefreshCookie(res, newRefreshToken, newRefreshExpiresAt);

    logger.info(`Auth: Token refreshed for user ${userId}`);

    return sendSuccess(res, {
      message: 'Token refreshed.',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken, // For mobile clients
        expiresAt: newAccessExpiresAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// POST /api/auth/logout
// Invalidate current session
// ═══════════════════════════════════════════════
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { id: userId, jti, tokenExp } = req.user;

    // ── 1. Blacklist the access token until it naturally expires ──────────────
    const ttlSeconds = tokenRemainingTTL({ exp: tokenExp });
    if (ttlSeconds > 0) {
      await redis.setex(RedisKeys.blacklist(jti), ttlSeconds, '1');
    }

    // ── 2. Delete refresh token cookie value (if passed in body) ─────────────
    const tokenFromBody = req.body?.refreshToken;
    const tokenFromCookie = req.cookies?.refreshToken;
    const refreshToken = tokenFromCookie || tokenFromBody;

    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        await redis.del(RedisKeys.refreshToken(userId, decoded.family));
      } catch {
        // Token might be expired — still clear the cookie
      }
    }

    // ── 3. Clear cookie and respond ───────────────────────────────────────────
    clearRefreshCookie(res);

    logger.info(`Auth: User ${userId} logged out.`);

    return sendSuccess(res, { message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// POST /api/auth/logout-all
// Invalidate ALL sessions for this user (all devices)
// ═══════════════════════════════════════════════
router.post('/logout-all', authenticate, async (req, res, next) => {
  try {
    const { id: userId, jti, tokenExp } = req.user;

    // Blacklist current access token
    const ttlSeconds = tokenRemainingTTL({ exp: tokenExp });
    if (ttlSeconds > 0) {
      await redis.setex(RedisKeys.blacklist(jti), ttlSeconds, '1');
    }

    // Delete all refresh token families for this user
    await invalidateAllUserSessions(userId);
    clearRefreshCookie(res);

    logger.info(`Auth: User ${userId} logged out of all sessions.`);

    return sendSuccess(res, { message: 'Logged out from all devices.' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// GET /api/auth/me
// Return the authenticated user's profile
// ═══════════════════════════════════════════════
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { id: userId } = req.user;

    // Check Redis cache first to avoid DB hit on every request
    const cached = await redis.get(RedisKeys.userCache(userId));
    if (cached) {
      return sendSuccess(res, { data: JSON.parse(cached) });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        id, name, mobile, email, role, employee_code,
        avatar_url, joining_date, is_active,
        target_monthly_revenue, target_monthly_orders, default_price_tier,
        created_at, last_login_at,
        territory:territory_id (id, name, city, state),
        manager:manager_id (id, name, mobile)
      `)
      .eq('id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !user) {
      return send404(res, { error: 'User not found.' });
    }

    // Cache for 5 minutes
    await redis.setex(RedisKeys.userCache(userId), 300, JSON.stringify(user));

    return sendSuccess(res, { data: user });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// PATCH /api/auth/me/password
// Change own password (requires current password)
// ═══════════════════════════════════════════════
router.patch('/me/password', authenticate, async (req, res, next) => {
  try {
    // ── 1. Validate input ─────────────────────────────────────────────────────
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return send400(res, { error: parsed.error.flatten().fieldErrors });
    }
    const { currentPassword, newPassword } = parsed.data;

    // ── 2. Get user with password hash ────────────────────────────────────────
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, password_hash')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return send404(res, { error: 'User not found.' });

    // ── 3. Verify current password ────────────────────────────────────────────
    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return send401(res, { error: 'Current password is incorrect.' });
    }

    // ── 4. Ensure new password is different ───────────────────────────────────
    const isSame = await verifyPassword(newPassword, user.password_hash);
    if (isSame) {
      return send400(res, { error: 'New password must be different from current password.' });
    }

    // ── 5. Hash and update ────────────────────────────────────────────────────
    const newHash = await hashPassword(newPassword);
    await supabaseAdmin
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', req.user.id);

    // ── 6. Invalidate all sessions (password change = security event) ─────────
    await invalidateAllUserSessions(req.user.id);
    clearRefreshCookie(res);

    logger.info(`Auth: User ${req.user.id} changed password.`);

    return sendSuccess(res, { message: 'Password changed. Please log in again.' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════
// Shared helper: invalidate all refresh token
// families for a user via Redis SCAN
// ═══════════════════════════════════════════════
async function invalidateAllUserSessions(userId) {
  try {
    // Use SCAN to find all rt:{userId}:* keys (avoids KEYS in production)
    const pattern = `rt:${userId}:*`;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');

    logger.info(`Auth: All sessions invalidated for user ${userId}`);
  } catch (err) {
    logger.error(`Auth: Failed to invalidate sessions for user ${userId}:`, err);
    // Don't throw — caller should still proceed
  }
}

export default router;
