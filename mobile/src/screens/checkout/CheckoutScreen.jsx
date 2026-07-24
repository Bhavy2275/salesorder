/**
 * CheckoutScreen.jsx — Multi-step Checkout Wizard
 *
 * Renders the step progress bar + the appropriate step component.
 * Checkout state is fully owned by useCheckout() hook.
 *
 * Steps:
 *   1  Review Order    → cart items, pricing
 *   2  Client Details  → client search, address, payment terms
 *   3  OTP Confirm     → 6-digit OTP entry
 *   4  Success         → confirmation screen + "Back to Home"
 */

import React, { useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle, withTiming, interpolate,
} from 'react-native-reanimated';

import { useCheckout } from '../../hooks/useCheckout';
import Step1_ReviewOrder from './Step1_ReviewOrder';
import Step2_ClientDetails from './Step2_ClientDetails';
import Step3_OTPConfirm from './Step3_OTPConfirm';
import OrderSuccessScreen from './OrderSuccessScreen';

const STEP_LABELS = ['Review', 'Details', 'Confirm'];

export default function CheckoutScreen() {
  const {
    step,
    STEPS,
    isLoading,
    error,
    order,
    otpMeta,
    attemptsLeft,
    otpError,
    cartItems,
    cartTotals,
    submitOrder,
    triggerSendOTP,
    submitOTP,
    goToStep,
    goBack,
    resetCheckout,
  } = useCheckout();

  // ── Back button behaviour per step ────────────────────────────────────
  const handleBack = useCallback(() => {
    if (step === STEPS.REVIEW) {
      router.back(); // Return to catalogue
    } else if (step === STEPS.CLIENT_DETAILS) {
      goBack();
    } else if (step === STEPS.OTP) {
      // Don't allow going back from OTP — order is already created + stock reserved
      // Instead show a warning
      goBack();
    }
  }, [step, STEPS, goBack]);

  const handleResendOTP = useCallback((channel) => {
    if (order?.id) {
      triggerSendOTP(order.id, channel);
    }
  }, [order?.id, triggerSendOTP]);

  // ── Success screen ────────────────────────────────────────────────────
  if (step === STEPS.SUCCESS) {
    return (
      <OrderSuccessScreen
        order={order}
        onDone={() => {
          resetCheckout();
          router.replace('/catalogue');
        }}
        onViewOrder={() => {
          resetCheckout();
          router.push(`/orders/${order?.id}`);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {step > STEPS.REVIEW ? (
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={22} color="#1F2937" />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color="#1F2937" />
          </Pressable>
        )}

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {step === STEPS.REVIEW && 'Review Order'}
            {step === STEPS.CLIENT_DETAILS && 'Client & Delivery'}
            {step === STEPS.OTP && 'Confirm Order'}
          </Text>
          <Text style={styles.headerSubtitle}>Step {step} of {Object.keys(STEPS).length - 1}</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      <StepProgressBar currentStep={step} totalSteps={3} labels={STEP_LABELS} />

      {/* ── Step content ──────────────────────────────────────────────── */}
      <View style={styles.content}>
        {step === STEPS.REVIEW && (
          <Step1_ReviewOrder
            totals={cartTotals}
            onProceed={() => {
              // Move to step 2 (client details) — no API call yet
              // eslint-disable-next-line no-undef
              goToStep(STEPS.CLIENT_DETAILS);
            }}
          />
        )}

        {step === STEPS.CLIENT_DETAILS && (
          <Step2_ClientDetails
            isLoading={isLoading}
            error={error}
            onSubmit={submitOrder}  // Creates order + reserves stock + triggers OTP
          />
        )}

        {step === STEPS.OTP && (
          <Step3_OTPConfirm
            otpMeta={otpMeta}
            order={order}
            isLoading={isLoading}
            otpError={otpError}
            attemptsLeft={attemptsLeft}
            onSubmitOTP={submitOTP}
            onResendOTP={handleResendOTP}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Step Progress Bar ────────────────────────────────────────────────────────
function StepProgressBar({ currentStep, totalSteps, labels }) {
  return (
    <View style={styles.progressContainer}>
      {Array(totalSteps).fill(0).map((_, i) => {
        const stepNum = i + 1;
        const isCompleted = currentStep > stepNum;
        const isActive = currentStep === stepNum;

        return (
          <React.Fragment key={stepNum}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle,
                isCompleted && styles.stepCircleCompleted,
                isActive && styles.stepCircleActive,
              ]}>
                {isCompleted ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={[
                    styles.stepNumber,
                    (isActive || isCompleted) && styles.stepNumberActive,
                  ]}>{stepNum}</Text>
                )}
              </View>
              <Text style={[
                styles.stepLabel,
                isActive && styles.stepLabelActive,
                isCompleted && styles.stepLabelCompleted,
              ]}>
                {labels[i]}
              </Text>
            </View>

            {/* Connector line */}
            {i < totalSteps - 1 && (
              <View style={[styles.connector, isCompleted && styles.connectorCompleted]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },

  // Progress bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  stepCircleActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  stepCircleCompleted: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  stepNumber: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  stepNumberActive: { color: '#fff' },
  stepLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  stepLabelActive: { color: '#7C3AED', fontWeight: '700' },
  stepLabelCompleted: { color: '#7C3AED' },

  connector: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginTop: -12, // Align with circle center
    marginHorizontal: 4,
  },
  connectorCompleted: { backgroundColor: '#7C3AED' },

  content: { flex: 1 },
});
