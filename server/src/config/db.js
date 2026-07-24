/**
 * db.js — Supabase Client Configuration
 *
 * Two clients:
 *  - `supabase`      : Uses ANON key — respects RLS (use for user-context queries)
 *  - `supabaseAdmin` : Uses SERVICE ROLE key — bypasses RLS (use for system operations
 *                      like creating users, sending notifications, etc.)
 *
 * IMPORTANT: Never expose supabaseAdmin to the frontend or any client-facing code.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// ─── Anon client (respects Row Level Security) ───────────────────────────────
// Use this for queries that should be scoped to the authenticated user's permissions
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,   // We handle tokens ourselves (custom JWT auth)
    persistSession: false,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public',
  },
});

// ─── Admin client (bypasses Row Level Security) ──────────────────────────────
// Use this only in trusted server-side contexts:
//  - Creating/updating users
//  - Sending notifications to other users
//  - System-level aggregations (cron jobs, reports)
//  - Operations that span multiple user contexts
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  }
);

/**
 * Creates a Supabase client authenticated as a specific user.
 * Used to enforce RLS on queries initiated on behalf of a user.
 *
 * @param {string} accessToken — The user's validated JWT access token
 * @returns Supabase client with user context
 */
export function createUserClient(accessToken) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
