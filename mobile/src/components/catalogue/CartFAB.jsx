/**
 * CartFAB.jsx — Floating Action Button showing cart summary
 *
 * Displays total items and grand total.
 * Tapping navigates to the Cart screen.
 * Animates in/out when cart is empty/non-empty.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/cartStore';

export default function CartFAB() {
  const items = useCartStore((s) => s.items);
  const getCartTotals = useCartStore((s) => s.getCartTotals);

  const totals = getCartTotals();
  const isEmpty = items.length === 0;

  // Slide-up animation
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: isEmpty ? 100 : 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: isEmpty ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isEmpty]);

  if (isEmpty) return null;

  const formatPrice = (price) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(price);

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <Pressable
        onPress={() => router.push('/cart')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        {/* Left: item count */}
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{items.length}</Text>
        </View>

        {/* Center: label */}
        <Text style={styles.label}>
          {totals.total_quantity} item{totals.total_quantity !== 1 ? 's' : ''} in cart
        </Text>

        {/* Right: total + arrow */}
        <View style={styles.rightSection}>
          <Text style={styles.totalText}>{formatPrice(totals.grand_total)}</Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  fabPressed: {
    transform: [{ scale: 0.98 }],
  },
  countBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  countText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  label: {
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  totalText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
