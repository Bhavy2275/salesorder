/**
 * otp.service.js — OTP Generation, Delivery & Verification
 *
 * Flow:
 *  1. generateAndStoreOTP(orderId, mobile) → stores bcrypt hash in Redis
 *  2. sendOTP(mobile, otp) → MSG91 SMS (WhatsApp fallback)
 *  3. verifyOTP(orderId, submittedOtp) → compare hash, log result
 *
 * Redis key: otp:{orderId}
 * Value: JSON { hash, mobile, attempts, createdAt }
 * TTL: OTP_TTL_SECONDS (600 = 10 minutes)
 *
 * Security:
 *  - OTP is 6 digits, cryptographically random
 *  - Stored as bcrypt hash (never plaintext)
 *  - Max 3 verification attempts before invalidation
 *  - Audit log written to otp_logs table (immutable)
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import redis, { RedisKeys } from '../config/redis.js';
import { supabaseAdmin } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const MAX_ATTEMPTS = 3;
const OTP_BCRYPT_ROUNDS = 8; // Lower rounds — OTP verification must be fast (<200ms)

// ─── OTP Generation ───────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt for uniform distribution (no modulo bias).
 */
function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

// ─── Store OTP in Redis ───────────────────────────────────────────────────────

/**
 * Generate OTP, hash it, and store in Redis with TTL.
 *
 * @param {string} orderId
 * @param {string} mobile - Mobile number the OTP will be sent to
 * @returns {string} The plaintext OTP (to be sent via SMS — never logged)
 */
export async function generateAndStoreOTP(orderId, mobile) {
  const otp = generateOTP();
  const hash = await bcrypt.hash(otp, OTP_BCRYPT_ROUNDS);

  const payload = JSON.stringify({
    hash,
    mobile,
    attempts: 0,
    createdAt: new Date().toISOString(),
  });

  // Store with TTL — auto-expires after 10 minutes
  await redis.setex(RedisKeys.otp(orderId), env.OTP_TTL_SECONDS, payload);

  logger.info(`OTP generated for order ${orderId}, mobile ${mobile.slice(-4).padStart(mobile.length, '*')}`);

  return otp; // Return plaintext — caller sends it via SMS and does NOT log it
}

// ─── Send OTP via MSG91 ───────────────────────────────────────────────────────

/**
 * Send OTP via MSG91 SMS.
 * Falls back to WhatsApp if SMS fails (MSG91 WhatsApp API).
 *
 * @param {string} mobile - 10-digit Indian mobile number
 * @param {string} otp - Plaintext 6-digit OTP
 * @param {'sms'|'whatsapp'} channel
 * @returns {Promise<{success: boolean, channel: string, messageId: string|null}>}
 */
export async function sendOTP(mobile, otp, channel = 'sms') {
  // In development, skip real SMS and log OTP to console
  if (env.NODE_ENV !== 'production') {
    logger.warn(`[DEV MODE] OTP for ${mobile}: ${otp} (not sent via SMS)`);
    return { success: true, channel: 'dev_console', messageId: 'dev-mock-id' };
  }

  try {
    const result = await sendViaMSG91(mobile, otp);
    logger.info(`OTP sent via SMS to ${mobile.slice(-4).padStart(mobile.length, '*')}`);
    return { success: true, channel: 'sms', messageId: result.messageId };
  } catch (smsError) {
    logger.warn(`SMS send failed for ${mobile}, attempting WhatsApp fallback:`, smsError.message);

    try {
      const result = await sendViaWhatsApp(mobile, otp);
      logger.info(`OTP sent via WhatsApp to ${mobile.slice(-4).padStart(mobile.length, '*')}`);
      return { success: true, channel: 'whatsapp', messageId: result.messageId };
    } catch (waError) {
      logger.error(`OTP delivery completely failed for ${mobile}:`, waError.message);
      throw new Error('Failed to send OTP via SMS and WhatsApp. Please try again.');
    }
  }
}

async function sendViaMSG91(mobile, otp) {
  // MSG91 Flow API — https://docs.msg91.com/reference/send-otp
  const response = await axios.post(
    'https://control.msg91.com/api/v5/otp',
    {
      template_id: env.MSG91_TEMPLATE_ID,
      mobile: `91${mobile}`, // Prefix country code
      authkey: env.MSG91_AUTH_KEY,
      otp,
    },
    { timeout: 10000 }
  );

  if (response.data.type !== 'success') {
    throw new Error(`MSG91 API error: ${response.data.message}`);
  }

  return { messageId: response.data.request_id };
}

async function sendViaWhatsApp(mobile, otp) {
  // MSG91 WhatsApp API — uses same template
  const response = await axios.post(
    'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
    {
      integrated_number: env.MSG91_WHATSAPP_NUMBER,
      content_type: 'template',
      payload: {
        to: `91${mobile}`,
        type: 'template',
        template: {
          name: 'otp_verification',
          language: { code: 'en' },
          components: [{
            type: 'body',
            parameters: [{ type: 'text', text: otp }],
          }],
        },
      },
    },
    {
      headers: { authkey: env.MSG91_AUTH_KEY },
      timeout: 10000,
    }
  );

  return { messageId: response.data?.data?.message_id || null };
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────

/**
 * Verify the OTP submitted by the client.
 *
 * @param {string} orderId
 * @param {string} submittedOtp - 6-digit code entered by client
 * @param {object} auditMeta - { salespersonId, clientId, mobile, deviceId, ip, lat, lng }
 * @returns {Promise<{valid: boolean, reason?: string, attemptsLeft?: number}>}
 */
export async function verifyOTP(orderId, submittedOtp, auditMeta = {}) {
  const redisKey = RedisKeys.otp(orderId);
  const stored = await redis.get(redisKey);

  // ── 1. Check if OTP exists ────────────────────────────────────────────────
  if (!stored) {
    await writeOTPAuditLog(orderId, auditMeta, false, 'expired');
    return { valid: false, reason: 'OTP has expired. Please request a new OTP.' };
  }

  const data = JSON.parse(stored);

  // ── 2. Check attempt count ────────────────────────────────────────────────
  if (data.attempts >= MAX_ATTEMPTS) {
    await redis.del(redisKey); // Invalidate — too many attempts
    await writeOTPAuditLog(orderId, auditMeta, false, 'max_attempts');
    return { valid: false, reason: 'Too many incorrect attempts. Please request a new OTP.' };
  }

  // ── 3. Verify hash ────────────────────────────────────────────────────────
  const isMatch = await bcrypt.compare(submittedOtp, data.hash);

  if (!isMatch) {
    // Increment attempt counter and re-save
    data.attempts += 1;
    const ttl = await redis.ttl(redisKey);
    if (ttl > 0) {
      await redis.setex(redisKey, ttl, JSON.stringify(data));
    }

    const attemptsLeft = MAX_ATTEMPTS - data.attempts;
    await writeOTPAuditLog(orderId, auditMeta, false, 'invalid');

    return {
      valid: false,
      reason: attemptsLeft > 0
        ? `Incorrect OTP. ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining.`
        : 'Incorrect OTP. Maximum attempts reached.',
      attemptsLeft,
    };
  }

  // ── 4. Valid! Delete from Redis (one-time use) ────────────────────────────
  await redis.del(redisKey);
  await writeOTPAuditLog(orderId, auditMeta, true, null);

  logger.info(`OTP verified successfully for order ${orderId}`);
  return { valid: true };
}

// ─── OTP Audit Log ────────────────────────────────────────────────────────────

/**
 * Write an immutable audit log entry to otp_logs table.
 * Never throws — audit logging must not block the main flow.
 */
async function writeOTPAuditLog(orderId, meta, verified, failureReason) {
  try {
    await supabaseAdmin.from('otp_logs').insert({
      order_id: orderId,
      salesperson_id: meta.salespersonId,
      client_id: meta.clientId,
      mobile_sent_to: meta.mobile,
      channel: meta.channel || 'sms',
      expires_at: new Date(Date.now() + env.OTP_TTL_SECONDS * 1000).toISOString(),
      verified,
      verified_at: verified ? new Date().toISOString() : null,
      attempt_count: meta.attemptCount || 1,
      device_id: meta.deviceId,
      ip_address: meta.ip,
      geo_lat: meta.lat,
      geo_lng: meta.lng,
      failure_reason: failureReason,
    });
  } catch (err) {
    // Never throw from audit logging — log the error and continue
    logger.error('Failed to write OTP audit log:', err.message);
  }
}
