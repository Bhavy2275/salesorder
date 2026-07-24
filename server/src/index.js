/**
 * index.js — Server Entry Point
 *
 * Starts the HTTP server after verifying all connections (DB, Redis) are live.
 * Handles graceful shutdown on SIGTERM / SIGINT (Railway sends SIGTERM on deploy).
 */

import './config/env.js';       // Validate env vars first — will exit if invalid
import app from './app.js';
import redis from './config/redis.js';
import { supabaseAdmin } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const PORT = env.PORT;

// ─── Startup health checks ────────────────────────────────────────────────────
async function checkConnections() {
  logger.info('⚡ Anti Gravity API — Starting up...');

  // Check Redis
  try {
    await redis.ping();
    logger.info('✅ Redis: Connected');
  } catch (err) {
    logger.error('❌ Redis: Connection failed —', err.message);
    process.exit(1);
  }

  // Check Supabase / PostgreSQL
  try {
    const { error } = await supabaseAdmin.from('users').select('id').limit(1);
    if (error) throw error;
    logger.info('✅ Supabase / PostgreSQL: Connected');
  } catch (err) {
    if (env.NODE_ENV === 'development') {
      logger.warn('⚠️  Supabase check failed (dev) — server starting anyway.');
      logger.warn('   Fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in server/.env');
      logger.warn(`   Error: ${err.message}`);
    } else {
      logger.error('❌ Supabase: Connection failed —', err.message);
      process.exit(1);
    }
  }
}

// ─── Start server ─────────────────────────────────────────────────────────────
async function start() {
  await checkConnections();

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} [${env.NODE_ENV}]`);
    logger.info(`   Health: http://localhost:${PORT}/health`);
    logger.info(`   Auth:   http://localhost:${PORT}/api/auth`);
  });

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  // Railway / Docker sends SIGTERM when deploying a new version.
  // We stop accepting new connections, finish in-flight requests, then exit cleanly.
  async function shutdown(signal) {
    logger.info(`\n${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      logger.info('HTTP server closed.');

      // Close Redis connection
      await redis.quit();
      logger.info('Redis connection closed.');

      logger.info('✅ Graceful shutdown complete.');
      process.exit(0);
    });

    // Force exit after 15 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 15000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch unhandled errors — log them instead of crashing silently
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1); // Uncaught exceptions are unsafe — always exit
  });
}

start();
