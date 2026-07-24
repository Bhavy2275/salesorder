/**
 * Step1_ReviewOrder.jsx — Checkout Step 1: Order Review
 *
 * Shows:
 * - All cart items with product image, name, qty, price, free items from scheme
 * - Swipe to remove item
 * - Pricing breakdown (subtotal → GST → discount → grand total)
 * - "Proceed" button navigates to Step 2
 */

import React, { useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  Alert, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/cartStore';
import QuantityStepper from '../../components/catalogue/QuantityStepper';

const PLACEHOLDER = 'https://via.placeholder.com/80x80/EDE9FE/7C3AED?text=•';

export default function Step1_ReviewOrder({ totals, onProceed }) {
  const items = useCartStore((s) => s.items);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const setQuantity = useCartStore((s) => s.setQuantity);

  const formatPrice = (p) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(p);

  const handleRemove = useCallback((item) => {
    Alert.alert(
      'Remove Item',
      `Remove "${item.name}" from cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFromCart(item.productId),
        },
      ]
    );
  }, [removeFromCart]);

  const renderItem = useCallback(({ item }) => (
    <View style={styles.cartItem}>
      {/* Product image */}
      <Image
        source={{ uri: item.image_url || PLACEHOLDER }}
        style={styles.itemImage}
        contentFit="cover"
        transition={150}
      />

      {/* Item details */}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.itemSku}>SKU: {item.sku_code}</Text>

        {/* Scheme badge */}
        {item.scheme_name && (
          <View style={styles.schemeBadge}>
            <Text style={styles.schemeBadgeText}>🎁 {item.scheme_name}</Text>
          </View>
        )}

        {/* Free items note */}
        {item.free_qty > 0 && (
          <Text style={styles.freeQtyNote}>
            +{item.free_qty} free {item.unit}{item.free_qty > 1 ? 's' : ''} included
          </Text>
        )}

        {/* Price per unit */}
        <Text style={styles.unitPrice}>
          {formatPrice(item.unit_price)} / {item.unit}
          {item.gst_percent > 0 ? ` +${item.gst_percent}% GST` : ''}
        </Text>
      </View>

      {/* Right: stepper + line total + remove */}
      <View style={styles.itemRight}>
        <Pressable
          onPress={() => handleRemove(item)}
          style={styles.removeBtn}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </Pressable>

        <QuantityStepper
          quantity={item.quantity}
          onAdd={() => setQuantity(item.productId, item.quantity + 1)}
          onRemove={() => setQuantity(item.productId, item.quantity - 1)}
          maxQty={item.allow_backorder ? undefined : item.stock_qty}
          size="sm"
        />

        <Text style={styles.lineTotal}>
          {formatPrice(item.unit_price * item.quantity)}
        </Text>
      </View>
    </View>
  ), [handleRemove, setQuantity]);

  const isEmpty = items.length === 0;

  return (
    <View style={styles.container}>
      {isEmpty ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add products to continue.</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(i) => i.productId}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              <PricingBreakdown totals={totals} formatPrice={formatPrice} />
            }
          />

          <View style={styles.footer}>
            <View>
              <Text style={styles.footerLabel}>Grand Total (incl. GST)</Text>
              <Text style={styles.footerTotal}>{formatPrice(totals.grand_total)}</Text>
            </View>
            <Pressable
              onPress={onProceed}
              disabled={isEmpty}
              style={({ pressed }) => [
                styles.proceedBtn,
                pressed && styles.proceedBtnPressed,
              ]}
            >
              <Text style={styles.proceedBtnText}>Select Client</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function PricingBreakdown({ totals, formatPrice }) {
  return (
    <View style={styles.pricingCard}>
      <Text style={styles.pricingTitle}>Order Summary</Text>

      <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
      <Row label="GST" value={`+${formatPrice(totals.total_gst)}`} valueStyle={{ color: '#6B7280' }} />

      {totals.discount_amount > 0 && (
        <Row
          label="Scheme Discount"
          value={`-${formatPrice(totals.discount_amount)}`}
          valueStyle={{ color: '#10B981', fontWeight: '700' }}
        />
      )}

      <View style={styles.divider} />

      <Row
        label="Grand Total"
        value={formatPrice(totals.grand_total)}
        labelStyle={{ fontWeight: '700', fontSize: 15, color: '#111827' }}
        valueStyle={{ fontWeight: '900', fontSize: 18, color: '#111827' }}
      />

      <Text style={styles.taxNote}>* All prices include applicable taxes</Text>
    </View>
  );
}

function Row({ label, value, labelStyle, valueStyle }) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, labelStyle]}>{label}</Text>
      <Text style={[styles.priceValue, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  list: { padding: 16, paddingBottom: 8 },

  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#F5F3FF',
  },
  itemInfo: { flex: 1, justifyContent: 'center' },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 18,
  },
  itemSku: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  schemeBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  schemeBadgeText: { fontSize: 10, color: '#7C3AED', fontWeight: '600' },
  freeQtyNote: { fontSize: 10, color: '#10B981', fontWeight: '600', marginTop: 3 },
  unitPrice: { fontSize: 11, color: '#6B7280', marginTop: 4 },

  itemRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minWidth: 80,
  },
  removeBtn: {
    padding: 4,
  },
  lineTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },

  pricingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  pricingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  priceLabel: { fontSize: 13, color: '#6B7280' },
  priceValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  taxNote: { fontSize: 10, color: '#9CA3AF', marginTop: 10 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerLabel: { fontSize: 11, color: '#9CA3AF' },
  footerTotal: { fontSize: 20, fontWeight: '900', color: '#111827' },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  proceedBtnPressed: { opacity: 0.85 },
  proceedBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 6 },
});
