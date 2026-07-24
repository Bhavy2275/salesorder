/**
 * env.js — Environment Variable Validation
 * 
 * Validates all required env vars at startup using Zod.
 * The app will refuse to start if any required variable is missing,
 * preventing silent misconfigurations in production.
 */

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),

  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(10, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  REDIS_OPTIONAL: z.string().default('false'),  // Set 'true' in dev to skip Redis

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_SECONDS: z.coerce.number().default(604800),

  // Security
  BCRYPT_ROUNDS: z.coerce.number().min(10).max(14).default(10),
  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  ACCOUNT_LOCK_DURATION_MINUTES: z.coerce.number().default(30),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // OTP (optional in dev — skipped automatically if NODE_ENV != production)
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  MSG91_WHATSAPP_NUMBER: z.string().optional(),
  OTP_TTL_SECONDS: z.coerce.number().default(600),

  // Cloudinary (PDF storage)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // PDF generation
  SKIP_PDF_IN_DEV: z.string().default('true'),  // Set false to test Puppeteer locally

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1); // Hard fail — do not start with bad config
}

export const env = parsed.data;
