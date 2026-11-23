import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../src/store/cartStore';

const fmt = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

export default function CartRoute() {
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const totals = useCartStore((s) => s.getCartTotals());

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={23} color="#111827" /></Pressable>
        <Text style={styles.title}>Your order</Text>
        <View style={{ width: 24 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Your cart is empty</Text><Text style={styles.muted}>Add products from the catalogue to start an order.</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.muted}>{item.sku_code} · {fmt(item.unit_price)} / {item.unit}</Text>
              {item.free_qty > 0 && <Text style={styles.free}>+{item.free_qty} free</Text>}
              <Text style={styles.price}>{fmt(item.unit_price * item.quantity)}</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable onPress={() => setQuantity(item.productId, item.quantity - 1)} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable>
              <Text style={styles.qty}>{item.quantity}</Text>
              <Pressable onPress={() => setQuantity(item.productId, Math.min(item.quantity + 1, item.stock_qty || item.quantity + 1))} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable>
            </View>
          </View>
        )}
      />
      {items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}><Text style={styles.muted}>Subtotal</Text><Text>{fmt(totals.subtotal)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.muted}>GST</Text><Text>{fmt(totals.total_gst)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.grandLabel}>Total</Text><Text style={styles.grand}>{fmt(totals.grand_total)}</Text></View>
          <Pressable onPress={() => router.push('/checkout')} style={styles.checkout}><Text style={styles.checkoutText}>Continue to checkout</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { height: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#F3F4F6' },
  title: { fontSize: 17, fontWeight: '800', color: '#111827' },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  item: { backgroundColor: '#fff', padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  name: { color: '#111827', fontSize: 14, fontWeight: '700' },
  muted: { color: '#6B7280', fontSize: 12, marginTop: 3 },
  price: { color: '#111827', fontWeight: '800', marginTop: 6 },
  free: { color: '#059669', fontSize: 12, fontWeight: '700', marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F3FF', borderRadius: 10 },
  stepButton: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#6D28D9', fontSize: 22, fontWeight: '600' },
  qty: { minWidth: 24, textAlign: 'center', color: '#111827', fontWeight: '800' },
  empty: { alignItems: 'center', padding: 40, marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  footer: { backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#E5E7EB', padding: 16, gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandLabel: { fontSize: 16, fontWeight: '800', color: '#111827' },
  grand: { fontSize: 18, fontWeight: '900', color: '#111827' },
  checkout: { marginTop: 8, backgroundColor: '#7C3AED', borderRadius: 12, padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  checkoutText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
