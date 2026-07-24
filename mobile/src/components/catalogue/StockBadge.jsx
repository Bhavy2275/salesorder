/**
 * StockBadge.jsx — Visual stock status indicator
 *
 * Displays "In Stock", "Low Stock", or "Out of Stock"
 * with colour-coded background.
 */

import React from 'react';
import { View, Text } from 'react-native';

const CONFIG = {
  in_stock: {
    label: 'In Stock',
    bg: '#D1FAE5',       // green-100
    text: '#065F46',     // green-800
    dot: '#10B981',      // green-500
  },
  low_stock: {
    label: 'Low Stock',
    bg: '#FEF3C7',       // amber-100
    text: '#92400E',     // amber-800
    dot: '#F59E0B',      // amber-500
  },
  out_of_stock: {
    label: 'Out of Stock',
    bg: '#FEE2E2',       // red-100
    text: '#991B1B',     // red-800
    dot: '#EF4444',      // red-500
  },
};

export default function StockBadge({ status, qty, size = 'sm' }) {
  const cfg = CONFIG[status] || CONFIG.in_stock;
  const isSmall = size === 'sm';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: cfg.bg,
        borderRadius: 100,
        paddingHorizontal: isSmall ? 8 : 10,
        paddingVertical: isSmall ? 3 : 5,
        alignSelf: 'flex-start',
      }}
    >
      {/* Pulsing dot */}
      <View
        style={{
          width: isSmall ? 6 : 8,
          height: isSmall ? 6 : 8,
          borderRadius: 100,
          backgroundColor: cfg.dot,
          marginRight: isSmall ? 4 : 6,
        }}
      />
      <Text
        style={{
          fontSize: isSmall ? 10 : 12,
          fontWeight: '600',
          color: cfg.text,
          letterSpacing: 0.2,
        }}
      >
        {cfg.label}
        {status === 'low_stock' && qty !== undefined ? ` (${qty} left)` : ''}
      </Text>
    </View>
  );
}
