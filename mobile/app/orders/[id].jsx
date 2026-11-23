import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { fetchOrderDetail } from '../../src/api/orders.api';

const fmt = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

export default function OrderDetailRoute() {
  const { id } = useLocalSearchParams();
  const { data: order, isLoading, error } = useQuery({ queryKey: ['order', id], queryFn: () => fetchOrderDetail(id), enabled: Boolean(id) });

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}><Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={23} color="#111827" /></Pressable><Text style={styles.title}>Order details</Text><View style={{ width: 23 }} /></View>
      {isLoading ? <ActivityIndicator style={{ marginTop: 40 }} color="#7C3AED" /> : error || !order ? <Text style={styles.error}>Could not load this order. Check your connection and permissions.</Text> : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.orderNumber}>Order #{order.order_number}</Text>
          <Text style={styles.status}>{order.status}</Text>
          <Text style={styles.client}>{order.client?.business_name}</Text>
          {order.items?.map((item) => <View key={item.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.itemName}>{item.product_name}</Text><Text style={styles.muted}>{item.quantity} {item.unit} × {fmt(item.unit_price)}</Text></View><Text style={styles.itemTotal}>{fmt(item.line_total)}</Text></View>)}
          <View style={styles.total}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{fmt(order.grand_total)}</Text></View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { height: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
  title: { fontSize: 17, fontWeight: '800', color: '#111827' },
  content: { padding: 18 },
  orderNumber: { fontSize: 21, fontWeight: '900', color: '#111827' },
  status: { color: '#6D28D9', fontWeight: '700', textTransform: 'capitalize', marginTop: 4 },
  client: { color: '#4B5563', marginTop: 8, marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  itemName: { color: '#111827', fontWeight: '700' },
  muted: { color: '#6B7280', fontSize: 12, marginTop: 4 },
  itemTotal: { fontWeight: '800', color: '#111827' },
  total: { marginTop: 12, paddingVertical: 16, borderTopWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: '#111827', fontWeight: '800', fontSize: 16 },
  totalValue: { color: '#111827', fontWeight: '900', fontSize: 18 },
  error: { margin: 24, color: '#B91C1C' },
});
