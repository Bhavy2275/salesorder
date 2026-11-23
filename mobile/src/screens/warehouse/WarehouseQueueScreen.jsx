/**
 * WarehouseQueueScreen.jsx — Mobile view for warehouse staff
 *
 * Shows orders to fulfil sorted by priority.
 * Tap any card → FulfilmentDetailScreen with picking checklist.
 */
import React, { useState } from 'react';
import {
  View, Text, FlatList, Pressable, TextInput,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from '../../api/apiConfig';

const STATUS_COLORS = {
  placed:     { bg: '#DBEAFE', text: '#1D4ED8', dot: '#3B82F6' },
  picking:    { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  packed:     { bg: '#FFEDD5', text: '#9A3412', dot: '#F97316' },
  dispatched: { bg: '#EDE9FE', text: '#4C1D95', dot: '#7C3AED' },
};

const STATUS_LABELS = {
  placed: 'Pending',
  picking: 'Picking',
  packed: 'Packed',
  dispatched: 'Dispatched',
};

async function fetchQueue(status, search) {
  const token = await SecureStore.getItemAsync('accessToken');
  const params = { limit: 50 };
  if (status !== 'all') params.status = status;
  if (search) params.search = search;

  const { data } = await axios.get(`${API_BASE}/api/warehouse/queue`, {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.data || [];
}

async function fetchStats() {
  const token = await SecureStore.getItemAsync('accessToken');
  const { data } = await axios.get(`${API_BASE}/api/warehouse/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.data;
}

export default function WarehouseQueueScreen() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['warehouse', 'queue', activeTab, search],
    queryFn: () => fetchQueue(activeTab, search),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['warehouse', 'stats'],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  });

  const TABS = [
    { value: 'all',        label: 'All',        count: (stats?.total_placed || 0) + (stats?.total_picking || 0) + (stats?.total_packed || 0) },
    { value: 'placed',     label: 'Pending',    count: stats?.total_placed },
    { value: 'picking',    label: 'Picking',    count: stats?.total_picking },
    { value: 'packed',     label: 'Packed',     count: stats?.total_packed },
  ];

  const formatINR = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const renderCard = ({ item }) => {
    const sc = STATUS_COLORS[item.status] || STATUS_COLORS.placed;
    const isOverdue = item.is_overdue;

    return (
      <Pressable
        onPress={() => router.push(`/warehouse/${item.id}`)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      >
        {/* Overdue strip */}
        {isOverdue && <View style={styles.overdueStrip} />}

        <View style={styles.cardTop}>
          {/* Order number + status */}
          <View style={{ flex: 1 }}>
            <View style={styles.cardMeta}>
              <Text style={styles.orderNumber}>#{item.order_number}</Text>
              <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                <View style={[styles.dot, { backgroundColor: sc.dot }]} />
                <Text style={[styles.badgeText, { color: sc.text }]}>
                  {STATUS_LABELS[item.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.clientName}>{item.client_name}</Text>
            <Text style={styles.salesperson}>
              <Ionicons name="person-outline" size={11} color="#9CA3AF" /> {item.salesperson_name}
            </Text>
          </View>

          <View style={styles.cardRight}>
            <Text style={styles.total}>{formatINR(item.grand_total)}</Text>
            <Text style={styles.itemCount}>{item.item_count} items</Text>
            <Text style={styles.totalQty}>{item.total_quantity} pcs</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          {item.delivery_date ? (
            <View style={[styles.deliveryChip, isOverdue && styles.deliveryChipOverdue]}>
              <Ionicons
                name="calendar-outline"
                size={11}
                color={isOverdue ? '#DC2626' : '#6B7280'}
              />
              <Text style={[styles.deliveryText, isOverdue && { color: '#DC2626', fontWeight: '700' }]}>
                {isOverdue ? '⚠ OVERDUE — ' : ''}
                Deliver by {new Date(item.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          ) : (
            <Text style={styles.noDelivery}>No delivery date set</Text>
          )}
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Ionicons name="cube-outline" size={20} color="#7C3AED" />
          <Text style={styles.headerText}>Fulfilment Queue</Text>
        </View>
        {isFetching && <ActivityIndicator size="small" color="#7C3AED" />}
      </View>

      {/* ── Quick stats strip ── */}
      {stats && (
        <View style={styles.statsStrip}>
          <StripStat label="Pending"    value={stats.total_placed}     color="#3B82F6" />
          <StripStat label="Picking"    value={stats.total_picking}    color="#F59E0B" />
          <StripStat label="Packed"     value={stats.total_packed}     color="#F97316" />
          <StripStat label="Delivered"  value={stats.total_delivered}  color="#10B981" />
        </View>
      )}

      {/* ── Search ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={15} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search order, client…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </Pressable>
        )}
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.value}
            onPress={() => setActiveTab(tab.value)}
            style={[styles.tab, activeTab === tab.value && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.value && styles.tabTextActive]}>
              {tab.label}
              {tab.count != null && ` (${tab.count})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── List ── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Loading queue…</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderCard}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#7C3AED" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="checkmark-circle-outline" size={56} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>All clear!</Text>
              <Text style={styles.emptyText}>No orders in this queue.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function StripStat({ label, value, color }) {
  return (
    <View style={styles.stripStat}>
      <Text style={[styles.stripValue, { color }]}>{value ?? 0}</Text>
      <Text style={styles.stripLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { fontSize: 18, fontWeight: '800', color: '#111827' },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 10,
  },
  stripStat: { flex: 1, alignItems: 'center' },
  stripValue: { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  stripLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    marginBottom: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 6,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabActive: { backgroundColor: '#7C3AED' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#fff' },

  list: { padding: 12, paddingTop: 6, gap: 10, paddingBottom: 40 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  overdueStrip: { height: 3, backgroundColor: '#EF4444' },
  cardTop: { flexDirection: 'row', padding: 14, paddingBottom: 10 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  orderNumber: { fontFamily: 'monospace', fontWeight: '800', fontSize: 13, color: '#7C3AED' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  clientName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  salesperson: { fontSize: 11, color: '#9CA3AF' },
  cardRight: { alignItems: 'flex-end', justifyContent: 'center' },
  total: { fontSize: 17, fontWeight: '900', color: '#111827' },
  itemCount: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  totalQty: { fontSize: 10, color: '#9CA3AF' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
    backgroundColor: '#FAFAFA',
  },
  deliveryChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  deliveryChipOverdue: {},
  deliveryText: { fontSize: 11, color: '#6B7280' },
  noDelivery: { fontSize: 11, color: '#D1D5DB' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  loadingText: { color: '#9CA3AF', fontSize: 13, marginTop: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
});
