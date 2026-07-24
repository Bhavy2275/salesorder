/**
 * hash.js — Bcrypt & Crypto Helpers
 */

import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/**
 * Hash a plain-text password.
 * @param {string} password
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

/**
 * Compare a plain-text password against a stored bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Hash a token (refresh token, OTP) for storage.
 * bcrypt is used here too — not just for passwords.
 * Rounds set lower (8) for token hashing because tokens are already random
 * and bcrypt is used only for storage security, not key stretching.
 *
 * @param {string} token
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashToken(token) {
  return bcrypt.hash(token, 8);
}

/**
 * Verify a token against its stored bcrypt hash.
 * @param {string} token
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyToken(token, hash) {
  return bcrypt.compare(token, hash);
}
