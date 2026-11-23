/**
 * OrderSuccessScreen.jsx — Post-confirmation celebration screen
 *
 * Shows after OTP verification succeeds.
 * Includes order number, summary, and CTAs.
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePDF } from '../../hooks/usePDF';
import {
  discoverReceiptPrinters,
  getSavedReceiptPrinterName,
  saveReceiptPrinter,
} from '../../services/printer.service';

export default function OrderSuccessScreen({ order, onDone, onViewOrder, printerStatus = 'idle', printerError, onPrint }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const { downloadAndShare, loading: pdfLoading, error: pdfError } = usePDF();
  const [printerName, setPrinterName] = React.useState(null);
  const [connectingPrinter, setConnectingPrinter] = React.useState(false);

  useEffect(() => {
    getSavedReceiptPrinterName().then(setPrinterName).catch(() => {});
  }, []);

  const connectPrinter = async () => {
    setConnectingPrinter(true);
    try {
      const printers = await discoverReceiptPrinters();
      if (!printers.length) {
        Alert.alert('No printer found', 'Turn on the SRS588 printer and pair it in Bluetooth settings, then scan again.');
        return;
      }
      Alert.alert(
        'Select receipt printer',
        'Choose the SHREYANS 58mm printer to save it for future orders.',
        printers.map((printer) => ({
          text: printer.name || 'Bluetooth printer',
          onPress: async () => {
            try {
              await saveReceiptPrinter(printer);
              setPrinterName(printer.name || 'Receipt printer');
              await onPrint?.();
            } catch (err) {
              Alert.alert('Printer connection failed', err.message || 'Try again.');
            }
          },
        })).concat([{ text: 'Cancel', style: 'cancel' }])
      );
    } catch (err) {
      Alert.alert('Bluetooth unavailable', err.message || 'Check Bluetooth permission and try again.');
    } finally {
      setConnectingPrinter(false);
    }
  };

  useEffect(() => {
    // Celebration haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Bounce-in animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const formatPrice = (p) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(p);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* ── Success icon ─────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.iconWrap,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-circle" size={72} color="#10B981" />
          </View>
          {/* Ripple rings */}
          <View style={[styles.ring, styles.ring1]} />
          <View style={[styles.ring, styles.ring2]} />
        </Animated.View>

        <Animated.View style={{ opacity: opacityAnim, alignItems: 'center' }}>
          <Text style={styles.successTitle}>Order Confirmed! 🎉</Text>
          <Text style={styles.successSubtitle}>
            Your order has been sent to the warehouse for fulfilment.
          </Text>

          {/* Order details card */}
          {order && (
            <View style={styles.orderCard}>
              <View style={styles.orderRow}>
                <Text style={styles.orderRowLabel}>Order Number</Text>
                <Text style={styles.orderNumber}>#{order.order_number}</Text>
              </View>

              {order.client?.business_name && (
                <View style={styles.orderRow}>
                  <Text style={styles.orderRowLabel}>Client</Text>
                  <Text style={styles.orderRowValue}>{order.client.business_name}</Text>
                </View>
              )}

              {order.grand_total && (
                <View style={styles.orderRow}>
                  <Text style={styles.orderRowLabel}>Order Total</Text>
                  <Text style={[styles.orderRowValue, { color: '#111827', fontWeight: '800' }]}>
                    {formatPrice(order.grand_total)}
                  </Text>
                </View>
              )}

              <View style={styles.orderRow}>
                <Text style={styles.orderRowLabel}>Status</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Processing</Text>
                </View>
              </View>
            </View>
          )}

          {/* Bluetooth thermal receipt printer */}
          {order?.id && (
            <View style={styles.printerCard}>
              <View style={styles.printerHeading}>
                <Ionicons name="print-outline" size={19} color="#4C1D95" />
                <Text style={styles.printerTitle}>58mm receipt</Text>
                <Text style={[styles.printerStatus, printerStatus === 'printed' && styles.printerSuccess]}>
                  {printerStatus === 'printing' ? 'Printing…' : printerStatus === 'printed' ? 'Printed' : printerStatus === 'failed' ? 'Print failed' : 'Not printed'}
                </Text>
              </View>
              <Text style={styles.printerDescription}>
                {printerError || (printerName ? `Printer: ${printerName}` : 'Connect your SHREYANS Bluetooth printer to print the bill.')}
              </Text>
              <View style={styles.printerActions}>
                <Pressable
                  onPress={printerName ? onPrint : connectPrinter}
                  disabled={printerStatus === 'printing' || connectingPrinter}
                  style={({ pressed }) => [styles.printerBtn, (pressed || printerStatus === 'printing' || connectingPrinter) && { opacity: 0.65 }]}
                >
                  {printerStatus === 'printing' || connectingPrinter
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name={printerName ? 'print' : 'bluetooth'} size={17} color="#fff" />}
                  <Text style={styles.printerBtnText}>
                    {connectingPrinter ? 'Finding printer…' : printerStatus === 'printing' ? 'Printing…' : printerName ? (printerStatus === 'printed' ? 'Print another copy' : 'Retry print') : 'Connect printer & print'}
                  </Text>
                </Pressable>
                {printerName && (
                  <Pressable onPress={connectPrinter} style={styles.changePrinterBtn}>
                    <Text style={styles.changePrinterText}>Change</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* What happens next */}
          <View style={styles.nextStepsCard}>
            <Text style={styles.nextStepsTitle}>What happens next?</Text>
            {[
              { icon: 'cube-outline', text: 'Warehouse team picks and packs your order' },
              { icon: 'car-outline', text: 'Order is dispatched and tracked in real-time' },
              { icon: 'notifications-outline', text: 'You\'ll get notified at every status change' },
            ].map((step, i) => (
              <View key={i} style={styles.nextStep}>
                <View style={styles.nextStepIcon}>
                  <Ionicons name={step.icon} size={16} color="#7C3AED" />
                </View>
                <Text style={styles.nextStepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── CTAs ─────────────────────────────────────────────────────── */}
        <View style={styles.ctas}>
          <Pressable
            onPress={onViewOrder}
            style={({ pressed }) => [styles.viewOrderBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
            <Text style={styles.viewOrderText}>View Order Details</Text>
          </Pressable>

          {/* ── PDF Download ─── */}
          {order?.id && (
            <Pressable
              onPress={() => downloadAndShare(order.id, order.order_number)}
              disabled={pdfLoading}
              style={({ pressed }) => [
                styles.pdfBtn,
                pressed && { opacity: 0.85 },
                pdfLoading && { opacity: 0.6 },
              ]}
            >
              {pdfLoading
                ? <ActivityIndicator size="small" color="#059669" />
                : <Ionicons name="download-outline" size={18} color="#059669" />}
              <Text style={styles.pdfBtnText}>
                {pdfLoading ? 'Preparing PDF…' : 'Download Order PDF'}
              </Text>
            </Pressable>
          )}
          {pdfError && (
            <Text style={styles.pdfError}>{pdfError}</Text>
          )}

          <Pressable
            onPress={onDone}
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.doneBtnText}>Back to Catalogue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  ring1: { width: 140, height: 140, opacity: 0.3 },
  ring2: { width: 160, height: 160, opacity: 0.15 },

  successTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 280,
  },

  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 10,
  },
  printerCard: {
    width: '100%',
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  printerHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  printerTitle: { color: '#4C1D95', fontSize: 14, fontWeight: '800', flex: 1 },
  printerStatus: { color: '#92400E', fontSize: 12, fontWeight: '700' },
  printerSuccess: { color: '#047857' },
  printerDescription: { color: '#6B7280', fontSize: 12, lineHeight: 17, marginTop: 6 },
  printerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  printerBtn: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 12 },
  printerBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  changePrinterBtn: { padding: 8 },
  changePrinterText: { color: '#6D28D9', fontWeight: '700', fontSize: 12 },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderRowLabel: { fontSize: 13, color: '#6B7280' },
  orderNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  orderRowValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#1D4ED8' },

  nextStepsCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  nextStepsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4C1D95',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextStep: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  nextStepIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepText: { flex: 1, fontSize: 13, color: '#5B21B6', lineHeight: 18 },

  ctas: { width: '100%', gap: 12 },
  viewOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EDE9FE',
    borderRadius: 14,
    padding: 16,
  },
  viewOrderText: { fontSize: 16, fontWeight: '700', color: '#7C3AED' },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  pdfBtnText: { fontSize: 16, fontWeight: '700', color: '#059669' },
  pdfError: { fontSize: 12, color: '#EF4444', textAlign: 'center', marginTop: -4 },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    padding: 16,
  },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
