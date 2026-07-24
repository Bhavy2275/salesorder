/**
 * redis.js — Redis client with graceful dev fallback
 *
 * If REDIS_OPTIONAL=true (in .env), exports a no-op stub so the server
 * boots without Redis. OTP / cache features silently skip when stub is active.
 */

import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// ─── Key builders ─────────────────────────────────────────────────────────────
export const RedisKeys = {
  otp:           (orderId)     => `otp:${orderId}`,
  refreshToken:  (userId, fam) => `rt:${userId}:${fam}`,
  userCache:     (userId)      => `user_cache:${userId}`,
  blacklist:     (jti)         => `blacklist:${jti}`,
  userSessions:  (userId)      => `sessions:${userId}`,
  loginAttempts: (id)          => `login_attempts:${id}`,
};

// ─── Build client ─────────────────────────────────────────────────────────────
function buildClient() {
  if (env.REDIS_OPTIONAL === 'true') {
    logger.warn('[Redis Stub] REDIS_OPTIONAL=true — OTP, cache, and sessions are disabled in dev.');
    const noop = async () => null;
    return {
      status: 'stub',
      get: noop, set: noop, setex: noop, del: noop,
      exists: async () => 0,
      incr: async () => 1, expire: noop,
      scan: async () => ['0', []],
      ping: async () => 'PONG',
      on: function () { return this; },
    };
  }

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 8) {
        logger.error('Redis: Max retries exceeded. Giving up.');
        return null;
      }
      return Math.min(times * 300, 3000);
    },
  });

  client.on('connect', () => logger.info('Redis: Connected ✓'));
  client.on('ready',   () => logger.info('Redis: Ready'));
  client.on('error',   (err) => logger.error('Redis error:', err.message));
  client.on('close',   () => logger.warn('Redis: Connection closed'));

  // Connect lazily — won't crash server on startup if Redis is down
  client.connect().catch((err) => {
    logger.error('Redis connect failed:', err.message);
  });

  return client;
}

const redis = buildClient();
export default redis;
