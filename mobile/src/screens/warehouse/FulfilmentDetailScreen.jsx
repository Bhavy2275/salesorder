/**
 * FulfilmentDetailScreen.jsx — Mobile picking/packing screen
 *
 * Warehouse staff use this to:
 * 1. Check off each item (picking)
 * 2. Mark as packed
 * 3. Mark as dispatched (with optional proof photo)
 * 4. Mark as delivered
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from '../../api/apiConfig';

const FLOW = {
  placed:     { next: 'picking',    cta: 'Start Picking',   color: '#3B82F6' },
  picking:    { next: 'packed',     cta: 'Mark as Packed',  color: '#F59E0B' },
  packed:     { next: 'dispatched', cta: 'Mark Dispatched', color: '#7C3AED' },
  dispatched: { next: 'delivered',  cta: 'Mark Delivered',  color: '#10B981' },
};

async function fetchOrderDetail(orderId) {
  const token = await SecureStore.getItemAsync('accessToken');
  const { data } = await axios.get(`${API_BASE}/api/warehouse/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.data;
}

async function transitionStatus(orderId, status, notes) {
  const token = await SecureStore.getItemAsync('accessToken');
  const { data } = await axios.patch(
    `${API_BASE}/api/warehouse/orders/${orderId}/status`,
    { status, notes },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.data;
}

export default function FulfilmentDetailScreen() {
  const { id: orderId } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState({});
  const [notes, setNotes] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['warehouse', 'order', orderId],
    queryFn: () => fetchOrderDetail(orderId),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: ({ status }) => transitionStatus(orderId, status, notes),
    onSuccess: (updated) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'queue'] });
      queryClient.setQueryData(['warehouse', 'order', orderId], updated);
      setChecked({});
      setNotes('');
    },
    onError: (err) => {
      const msg = err.response?.data?.error || 'Update failed. Please retry.';
      Alert.alert('Error', msg);
    },
  });

  const flow = order ? FLOW[order.status] : null;
  const isPicking = order?.status === 'picking';
  const allChecked = order?.items?.length > 0 && order.items.every((i) => checked[i.id]);
  const canAdvance = !isPicking || allChecked;

  const toggleCheck = useCallback((id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleAdvance = useCallback(() => {
    if (!flow || !canAdvance) return;
    Alert.alert(
      `Confirm: ${flow.cta}`,
      `Move order #${order?.order_number} to "${flow.next}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => mutation.mutate({ status: flow.next }) },
      ]
    );
  }, [flow, canAdvance, order, mutation]);

  const formatINR = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Header orderId={orderId} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Loading order…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Header orderId={orderId} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Header orderId={order.order_number} status={order.status} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Client + delivery info ── */}
        <View style={styles.section}>
          <View style={styles.clientRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{order.client?.business_name?.[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientName}>{order.client?.business_name}</Text>
              <Text style={styles.clientMeta}>{order.client?.mobile_primary}</Text>
            </View>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{formatINR(order.grand_total)}</Text>
            </View>
          </View>

          {order.client?.delivery_address && (
            <View style={styles.addressBox}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.addressText}>
                {order.client.delivery_address.line1}, {order.client.delivery_address.city} – {order.client.delivery_address.pincode}
              </Text>
            </View>
          )}

          {order.delivery_date && (
            <View style={styles.deliveryRow}>
              <Ionicons name="calendar-outline" size={13} color="#7C3AED" />
              <Text style={styles.deliveryText}>
                Deliver by {new Date(order.delivery_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
              </Text>
            </View>
          )}
        </View>

        {/* ── Picking list ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {isPicking ? 'Pick Items' : 'Order Items'}
            {' '}({order.items?.length})
          </Text>
          {isPicking && (
            <Text style={[styles.checkCount, allChecked && { color: '#10B981' }]}>
              {Object.values(checked).filter(Boolean).length}/{order.items?.length} ✓
            </Text>
          )}
        </View>

        <View style={styles.itemList}>
          {order.items?.map((item) => {
            const isChecked = checked[item.id];
            return (
              <Pressable
                key={item.id}
                onPress={() => isPicking && toggleCheck(item.id)}
                style={[styles.itemCard, isChecked && styles.itemCardChecked]}
                disabled={!isPicking}
              >
                <View style={styles.itemLeft}>
                  {isPicking && (
                    <Ionicons
                      name={isChecked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isChecked ? '#10B981' : '#D1D5DB'}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, isChecked && styles.itemNameDone]} numberOfLines={2}>
                      {item.product_name}
                    </Text>
                    <Text style={styles.itemSku}>{item.sku_code}</Text>
                    {item.scheme_name && (
                      <Text style={styles.itemScheme}>🎁 {item.scheme_name}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.itemRight}>
                  <Text style={[styles.itemQty, isChecked && { color: '#10B981' }]}>
                    ×{item.quantity}
                  </Text>
                  <Text style={styles.itemUnit}>{item.unit}</Text>
                  {item.free_qty > 0 && (
                    <Text style={styles.freeQty}>+{item.free_qty} free</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ── Notes ── */}
        {flow && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Warehouse Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Damage, partial delivery, special instructions…"
              placeholderTextColor="#9CA3AF"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>
        )}
      </ScrollView>

      {/* ── Sticky action button ── */}
      {flow && (
        <View style={styles.footer}>
          {isPicking && !allChecked && (
            <View style={styles.warningRow}>
              <Ionicons name="warning-outline" size={14} color="#D97706" />
              <Text style={styles.warningText}>Check off all items before proceeding</Text>
            </View>
          )}
          <Pressable
            onPress={handleAdvance}
            disabled={!canAdvance || mutation.isPending}
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: flow.color },
              (!canAdvance || mutation.isPending) && styles.ctaBtnDisabled,
              pressed && canAdvance && { opacity: 0.87 },
            ]}
          >
            {mutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            )}
            <Text style={styles.ctaBtnText}>
              {mutation.isPending ? 'Updating…' : flow.cta}
            </Text>
          </Pressable>
        </View>
      )}

      {!flow && order.status !== 'cancelled' && (
        <View style={styles.footer}>
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.completedText}>Order {order.status} — no further action needed.</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function Header({ orderId, status }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chevron-back" size={22} color="#1F2937" />
      </Pressable>
      <Text style={styles.headerTitle}>#{orderId}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },

  section: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 10,
  },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  clientName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  clientMeta: { fontSize: 12, color: '#9CA3AF' },
  totalBadge: { backgroundColor: '#EDE9FE', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  totalBadgeText: { fontSize: 14, fontWeight: '800', color: '#4C1D95' },
  addressBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10,
  },
  addressText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 17 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  deliveryText: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 },
  checkCount: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },

  itemList: { paddingHorizontal: 12, gap: 8 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },
  itemCardChecked: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  itemLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1F2937', lineHeight: 19 },
  itemNameDone: { color: '#6B7280', textDecorationLine: 'line-through' },
  itemSku: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  itemScheme: { fontSize: 11, color: '#7C3AED', fontWeight: '500', marginTop: 3 },
  itemRight: { alignItems: 'flex-end' },
  itemQty: { fontSize: 20, fontWeight: '900', color: '#111827' },
  itemUnit: { fontSize: 11, color: '#9CA3AF' },
  freeQty: { fontSize: 11, color: '#10B981', fontWeight: '600' },

  notesSection: { margin: 12, marginTop: 8 },
  notesLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  notesInput: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5,
    borderColor: '#E5E7EB', padding: 12, fontSize: 14, color: '#111827',
    minHeight: 80, textAlignVertical: 'top',
  },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6',
    padding: 16, paddingBottom: 28,
  },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  warningText: { fontSize: 12, color: '#D97706', fontWeight: '500' },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 16, padding: 18,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  ctaBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  ctaBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  completedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  completedText: { fontSize: 14, color: '#10B981', fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#9CA3AF', fontSize: 13 },
  errorText: { fontSize: 16, fontWeight: '700', color: '#374151' },
});
