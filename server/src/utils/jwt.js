/**
 * jwt.js — JWT Token Utilities
 *
 * Token Architecture:
 * ─────────────────────────────────────────
 * ACCESS TOKEN (15 min TTL):
 *   - Short-lived; sent in Authorization header on every request
 *   - Contains: { sub, role, name, jti }
 *   - Verified with JWT_ACCESS_SECRET
 *   - NOT stored anywhere (stateless)
 *
 * REFRESH TOKEN (7 day TTL):
 *   - Long-lived; sent in HttpOnly cookie OR secure storage on mobile
 *   - Contains: { sub, family, jti }
 *   - Verified with JWT_REFRESH_SECRET
 *   - Stored as bcrypt hash in Redis: key = rt:{userId}:{family}
 *   - Rotated on every use (old token invalidated, new one issued)
 *   - "Family" enables refresh token theft detection:
 *     If a stolen token is used after rotation, the entire family is invalidated.
 * ─────────────────────────────────────────
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

// ─── Access Token ─────────────────────────────────────────────────────────────

/**
 * Generate a short-lived access token for a user.
 *
 * @param {object} user - User record from database
 * @param {string} user.id
 * @param {string} user.role
 * @param {string} user.name
 * @returns {{ token: string, jti: string, expiresAt: Date }}
 */
export function generateAccessToken(user) {
  const jti = uuidv4(); // Unique token ID — used for blacklisting on logout

  const token = jwt.sign(
    {
      sub: user.id,          // Subject: user UUID
      role: user.role,       // RBAC role
      name: user.name,       // Display name (avoids extra DB lookup on every request)
      jti,                   // JWT ID for blacklisting
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      issuer: 'antigravity-api',
      audience: 'antigravity-app',
    }
  );

  // Calculate expiry time for client reference
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  return { token, jti, expiresAt };
}

/**
 * Verify and decode an access token.
 * Throws if token is invalid, expired, or has wrong issuer/audience.
 *
 * @param {string} token
 * @returns {object} Decoded payload
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'antigravity-api',
    audience: 'antigravity-app',
  });
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * Generate a long-lived refresh token.
 *
 * @param {string} userId - User UUID
 * @param {string} family - Token family UUID (shared across rotations for theft detection)
 * @returns {{ token: string, jti: string, family: string, expiresAt: Date }}
 */
export function generateRefreshToken(userId, family = null) {
  const tokenFamily = family || uuidv4(); // Create new family if not provided
  const jti = uuidv4();

  const token = jwt.sign(
    {
      sub: userId,
      family: tokenFamily, // All rotated tokens in a session share the same family
      jti,
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      issuer: 'antigravity-api',
      audience: 'antigravity-app',
    }
  );

  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  return { token, jti, family: tokenFamily, expiresAt };
}

/**
 * Verify and decode a refresh token.
 * Throws if token is invalid or expired.
 *
 * @param {string} token
 * @returns {object} Decoded payload
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'antigravity-api',
    audience: 'antigravity-app',
  });
}

/**
 * Decode a token WITHOUT verifying signature.
 * Use only when you need metadata from an expired token (e.g., to find the jti for cleanup).
 *
 * @param {string} token
 * @returns {object | null}
 */
export function decodeToken(token) {
  return jwt.decode(token);
}

/**
 * Calculate remaining TTL in seconds for a JWT.
 * Returns 0 if token is already expired.
 *
 * @param {object} decoded - Decoded JWT payload (with `exp` field)
 * @returns {number} seconds remaining
 */
export function tokenRemainingTTL(decoded) {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, decoded.exp - now);
}
