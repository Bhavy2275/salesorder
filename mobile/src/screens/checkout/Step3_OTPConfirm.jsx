/**
 * Step3_OTPConfirm.jsx — Checkout Step 3: OTP Verification
 *
 * Shows:
 * - "OTP sent to XXXXXX" confirmation
 * - 6-box digit input (each box one digit, auto-advance)
 * - Error display with attempts remaining
 * - Resend OTP with 30-second cooldown timer
 * - WhatsApp fallback button
 * - "Confirm Order" button (auto-submits when all 6 digits filled)
 */

import React, {
  useState, useRef, useCallback, useEffect,
} from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput,
  ActivityIndicator, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence,
  withTiming, withSpring,
} from 'react-native-reanimated';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function Step3_OTPConfirm({
  otpMeta,
  order,
  isLoading,
  otpError,
  attemptsLeft,
  onSubmitOTP,
  onResendOTP,
}) {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef([]);
  const shakeAnim = useSharedValue(0);

  // ── Resend countdown timer ─────────────────────────────────────────────
  useEffect(() => {
    setResendCooldown(RESEND_COOLDOWN);
    setCanResend(false);

    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [otpMeta]); // Reset when a new OTP is sent

  // ── Shake animation on error ───────────────────────────────────────────
  useEffect(() => {
    if (otpError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shakeAnim.value = withSequence(
        withTiming(-10, { duration: 60 }),
        withTiming(10, { duration: 60 }),
        withTiming(-8, { duration: 60 }),
        withTiming(8, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
      // Clear OTP on error so user can re-enter
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [otpError]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  // ── OTP input handling ─────────────────────────────────────────────────
  const handleDigitChange = useCallback((text, index) => {
    // Allow only digits
    const digit = text.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next box
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 are filled
    if (digit && index === OTP_LENGTH - 1) {
      const full = [...newOtp.slice(0, -1), digit].join('');
      if (full.length === OTP_LENGTH) {
        Keyboard.dismiss();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSubmitOTP(full);
      }
    }
  }, [otp, onSubmitOTP]);

  const handleKeyPress = useCallback((e, index) => {
    // Handle backspace — go to previous box
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  const handlePaste = useCallback((text, index) => {
    // If pasting a full 6-digit OTP
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (digits.length === OTP_LENGTH) {
      const newOtp = digits.split('');
      setOtp(newOtp);
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      Keyboard.dismiss();
      onSubmitOTP(digits);
    }
  }, [onSubmitOTP]);

  const fullOtp = otp.join('');
  const isComplete = fullOtp.length === OTP_LENGTH;

  const handleManualSubmit = useCallback(() => {
    if (!isComplete || isLoading) return;
    Keyboard.dismiss();
    onSubmitOTP(fullOtp);
  }, [isComplete, isLoading, fullOtp, onSubmitOTP]);

  return (
    <View style={styles.container}>
      {/* ── Header illustration ──────────────────────────────────────────── */}
      <View style={styles.topSection}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={48} color="#7C3AED" />
        </View>

        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          A 6-digit code was sent to your client's mobile
        </Text>

        {otpMeta && (
          <View style={styles.mobileBadge}>
            <Ionicons
              name={otpMeta.channel === 'whatsapp' ? 'logo-whatsapp' : 'phone-portrait-outline'}
              size={14}
              color="#7C3AED"
            />
            <Text style={styles.mobileBadgeText}>
              {otpMeta.maskedMobile}
            </Text>
            <View style={styles.channelPill}>
              <Text style={styles.channelPillText}>
                {otpMeta.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </Text>
            </View>
          </View>
        )}

        {/* Order number reference */}
        {order?.order_number && (
          <Text style={styles.orderRef}>Order #{order.order_number}</Text>
        )}
      </View>

      {/* ── OTP Input boxes ──────────────────────────────────────────────── */}
      <Animated.View style={[styles.otpRow, animatedStyle]}>
        {Array(OTP_LENGTH).fill(0).map((_, i) => (
          <TextInput
            key={i}
            ref={(ref) => { inputRefs.current[i] = ref; }}
            style={[
              styles.otpBox,
              otp[i] ? styles.otpBoxFilled : null,
              otpError ? styles.otpBoxError : null,
            ]}
            value={otp[i]}
            onChangeText={(t) => handleDigitChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            onChangeText={(t) => {
              // Handle paste of full OTP
              if (t.length > 1) { handlePaste(t, i); return; }
              handleDigitChange(t, i);
            }}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            selectTextOnFocus
            caretHidden
          />
        ))}
      </Animated.View>

      {/* ── Error message ────────────────────────────────────────────────── */}
      {otpError && (
        <View style={styles.errorBox}>
          <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
          <Text style={styles.errorText}>{otpError}</Text>
          {attemptsLeft !== undefined && attemptsLeft > 0 && (
            <Text style={styles.attemptsLeft}>
              {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left
            </Text>
          )}
        </View>
      )}

      {/* ── Expiry timer ─────────────────────────────────────────────────── */}
      {otpMeta?.expiresInSeconds && (
        <Text style={styles.expiryText}>
          OTP expires in {Math.floor(otpMeta.expiresInSeconds / 60)} minutes
        </Text>
      )}

      {/* ── Confirm button ───────────────────────────────────────────────── */}
      <Pressable
        onPress={handleManualSubmit}
        disabled={!isComplete || isLoading}
        style={({ pressed }) => [
          styles.confirmBtn,
          (!isComplete || isLoading) && styles.confirmBtnDisabled,
          pressed && isComplete && styles.confirmBtnPressed,
        ]}
      >
        {isLoading ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.confirmBtnText}>Verifying...</Text>
          </>
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.confirmBtnText}>Confirm Order</Text>
          </>
        )}
      </Pressable>

      {/* ── Resend section ───────────────────────────────────────────────── */}
      <View style={styles.resendSection}>
        {canResend ? (
          <View style={styles.resendOptions}>
            <Pressable
              onPress={() => onResendOTP('sms')}
              style={({ pressed }) => [styles.resendBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="phone-portrait-outline" size={14} color="#7C3AED" />
              <Text style={styles.resendBtnText}>Resend via SMS</Text>
            </Pressable>

            <Pressable
              onPress={() => onResendOTP('whatsapp')}
              style={({ pressed }) => [
                styles.resendBtn,
                styles.resendBtnWhatsApp,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
              <Text style={[styles.resendBtnText, { color: '#25D366' }]}>WhatsApp</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.resendCooldownText}>
            Resend OTP in <Text style={{ fontWeight: '700', color: '#7C3AED' }}>{resendCooldown}s</Text>
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  mobileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDE9FE',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
  },
  mobileBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4C1D95',
    letterSpacing: 2,
  },
  channelPill: {
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  channelPillText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  orderRef: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },

  // OTP Boxes
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  otpBox: {
    width: 48,
    height: 60,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  otpBoxFilled: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  otpBoxError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626' },
  attemptsLeft: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 2,
    width: '100%',
  },

  expiryText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 24,
  },

  // Confirm button
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    paddingVertical: 18,
    width: '100%',
    marginBottom: 24,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmBtnPressed: { opacity: 0.85 },
  confirmBtnDisabled: { backgroundColor: '#C4B5FD', shadowOpacity: 0 },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
  },

  // Resend
  resendSection: {
    alignItems: 'center',
  },
  resendCooldownText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  resendOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resendBtnWhatsApp: {
    backgroundColor: '#DCFCE7',
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
  },
});
