/**
 * useCheckout.js — Checkout Flow State Machine
 *
 * Manages the 3-step checkout state:
 *   Step 1: Review cart items (read-only)
 *   Step 2: Client + delivery details (form)
 *   Step 3: OTP verification (input + timer)
 *
 * State transitions:
 *   idle → submitting → orderCreated → otpSent → verifying → confirmed
 *                                             ↓
 *                                          otpFailed (retry)
 *
 * The hook owns the entire checkout session; screens are purely presentational.
 */

import { useState, useCallback, useRef } from 'react';
import { createOrder, sendOTP, verifyOTP } from '../api/orders.api';
import { useCartStore } from '../store/cartStore';
import { printConfirmedOrder } from '../services/printer.service';

const STEPS = { REVIEW: 1, CLIENT_DETAILS: 2, OTP: 3, SUCCESS: 4 };

export function useCheckout() {
  const [step, setStep] = useState(STEPS.REVIEW);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Created order (after Step 1 submission)
  const [order, setOrder] = useState(null);

  // OTP state
  const [otpMeta, setOtpMeta] = useState(null);   // { sentTo, maskedMobile, channel, expiresInSeconds }
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [otpError, setOtpError] = useState(null);
  const [printerStatus, setPrinterStatus] = useState('idle');
  const [printerError, setPrinterError] = useState(null);

  const cartItems = useCartStore((s) => s.items);
  const getCartTotals = useCartStore((s) => s.getCartTotals);
  const clearCart = useCartStore((s) => s.clearCart);
  const clientId = useCartStore((s) => s.clientId);
  const localDraftId = useRef(`draft_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const printOrder = useCallback(async (confirmedOrder) => {
    setPrinterStatus('printing');
    setPrinterError(null);
    try {
      const result = await printConfirmedOrder(confirmedOrder);
      setPrinterStatus(result.status);
    } catch (err) {
      setPrinterStatus('failed');
      setPrinterError(err.message || 'Could not print the bill.');
    }
  }, []);

  // ─── Step 1 → 2: Submit order (creates draft + reserves stock) ──────────
  const submitOrder = useCallback(async (deliveryDetails) => {
    setIsLoading(true);
    setError(null);

    try {
      const orderPayload = {
        clientId: deliveryDetails.clientId,
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          gstPercent: item.gst_percent,
          schemeId: item.scheme_id,
          schemeName: item.scheme_name,
          freeQty: item.free_qty,
          discountAmount: 0,
        })),
        deliveryAddress: deliveryDetails.deliveryAddress,
        deliveryDate: deliveryDetails.deliveryDate,
        paymentTerms: deliveryDetails.paymentTerms,
        notes: deliveryDetails.notes,
        localDraftId: localDraftId.current,
        createdOffline: false,
      };

      const createdOrder = await createOrder(orderPayload);
      setOrder(createdOrder);
      setStep(STEPS.OTP);

      // Immediately trigger OTP send after order creation
      await triggerSendOTP(createdOrder.id, 'sms');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [cartItems]);

  // ─── Send / Resend OTP ────────────────────────────────────────────────────
  const triggerSendOTP = useCallback(async (orderId, channel = 'sms') => {
    setIsLoading(true);
    setOtpError(null);

    try {
      const meta = await sendOTP(orderId || order?.id, channel);
      setOtpMeta(meta);
      setAttemptsLeft(3); // Reset on new OTP
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [order?.id]);

  // ─── Verify OTP ───────────────────────────────────────────────────────────
  const submitOTP = useCallback(async (otpCode, geo) => {
    if (!order?.id) return;
    setIsLoading(true);
    setOtpError(null);

    try {
      const confirmed = await verifyOTP(order.id, otpCode, undefined, geo);
      setOrder(confirmed);
      setStep(STEPS.SUCCESS);
      clearCart(); // 🎉 Order confirmed — clear the cart
      // Printing is best-effort; the confirmed order remains successful if
      // Bluetooth is unavailable or the printer is not configured yet.
      void printOrder(confirmed);
    } catch (err) {
      const errData = err.response?.data;
      const remaining = errData?.attemptsLeft;
      setAttemptsLeft(remaining ?? attemptsLeft - 1);
      setOtpError(errData?.error || 'Incorrect OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [order?.id, attemptsLeft, clearCart, printOrder]);

  // ─── Navigation helpers ───────────────────────────────────────────────────
  const goToStep = useCallback((s) => setStep(s), []);
  const goBack = useCallback(() => {
    if (step > STEPS.REVIEW) setStep((s) => s - 1);
  }, [step]);

  const resetCheckout = useCallback(() => {
    setStep(STEPS.REVIEW);
    setOrder(null);
    setOtpMeta(null);
    setError(null);
    setOtpError(null);
    setAttemptsLeft(3);
  }, []);

  return {
    // State
    step,
    STEPS,
    isLoading,
    error,
    order,
    otpMeta,
    attemptsLeft,
    otpError,
    printerStatus,
    printerError,

    // Cart snapshot
    cartItems,
    cartTotals: getCartTotals(),

    // Actions
    submitOrder,
    triggerSendOTP,
    submitOTP,
    printOrder,
    goToStep,
    goBack,
    resetCheckout,
  };
}
