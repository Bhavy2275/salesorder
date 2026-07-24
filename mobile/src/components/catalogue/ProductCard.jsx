/**
 * ProductCard.jsx — Visual product card for the catalogue grid
 *
 * Features:
 * - Product image (with fallback)
 * - Scheme ribbon (e.g., "Buy 10 Get 1 Free 🎉")
 * - Stock badge
 * - Price with GST indicator
 * - MRP with strikethrough
 * - Inline QuantityStepper
 * - Press to navigate to ProductDetail
 */

import React, { useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import StockBadge from './StockBadge';
import QuantityStepper from './QuantityStepper';
import { useCartStore } from '../../store/cartStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;   // 2 columns with margins

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x200/EDE9FE/7C3AED?text=No+Image';

export default function ProductCard({ product }) {
  const addToCart = useCartStore((s) => s.addToCart);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const getItemQty = useCartStore((s) => s.getItemQty);

  const quantity = getItemQty(product.id);
  const isOutOfStock = product.stock_status === 'out_of_stock' && !product.allow_backorder;

  // Format price with Indian locale (₹ XX,XX,XXX)
  const formatPrice = (price) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);

  const handlePress = useCallback(() => {
    router.push(`/catalogue/${product.id}`);
  }, [product.id]);

  const handleAdd = useCallback(() => {
    addToCart(product, 1);
  }, [addToCart, product]);

  const handleRemove = useCallback(() => {
    setQuantity(product.id, quantity - 1);
  }, [setQuantity, product.id, quantity]);

  // Discount percentage vs MRP
  const discountPct = product.mrp > product.effective_price
    ? Math.round(((product.mrp - product.effective_price) / product.mrp) * 100)
    : 0;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      {/* ── Scheme ribbon ──────────────────────────────────────────────────── */}
      {product.scheme?.ribbon_text && (
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText} numberOfLines={1}>
            {product.scheme.ribbon_text}
          </Text>
        </View>
      )}

      {/* ── Discount badge ─────────────────────────────────────────────────── */}
      {discountPct > 0 && !product.scheme && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{discountPct}% OFF</Text>
        </View>
      )}

      {/* ── Product image ───────────────────────────────────────────────────── */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: product.images?.[0] || PLACEHOLDER_IMAGE }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          placeholder={PLACEHOLDER_IMAGE}
        />

        {/* Dim overlay for out-of-stock */}
        {isOutOfStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        )}
      </View>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <View style={styles.content}>
        {/* Brand */}
        {product.brand?.name && (
          <Text style={styles.brandName} numberOfLines={1}>
            {product.brand.name}
          </Text>
        )}

        {/* Product name */}
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Pack size */}
        {product.pack_size && (
          <Text style={styles.packSize}>{product.pack_size}</Text>
        )}

        {/* Stock badge */}
        <View style={{ marginTop: 6 }}>
          <StockBadge
            status={product.stock_status}
            qty={product.stock_qty <= product.low_stock_threshold ? product.stock_qty : undefined}
            size="sm"
          />
        </View>

        {/* Pricing row */}
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.effectivePrice}>
              {formatPrice(product.effective_price)}
            </Text>
            <Text style={styles.gstLabel}>
              +{product.gst_percent}% GST
            </Text>
          </View>

          {product.mrp > product.effective_price && (
            <Text style={styles.mrp}>
              {formatPrice(product.mrp)}
            </Text>
          )}
        </View>

        {/* Stepper */}
        <View style={styles.stepperRow}>
          <QuantityStepper
            quantity={quantity}
            onAdd={handleAdd}
            onRemove={handleRemove}
            maxQty={product.allow_backorder ? undefined : product.stock_qty}
            disabled={isOutOfStock}
            size="sm"
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.04,
  },

  // ── Ribbon ─────────────────────────────────────────────────────────────────
  ribbon: {
    position: 'absolute',
    top: 10,
    left: -2,
    zIndex: 10,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  ribbonText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
    maxWidth: CARD_WIDTH - 24,
  },

  // ── Discount badge ─────────────────────────────────────────────────────────
  discountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  discountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  // ── Image ──────────────────────────────────────────────────────────────────
  imageContainer: {
    width: '100%',
    height: 130,
    backgroundColor: '#F5F3FF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  // ── Content ────────────────────────────────────────────────────────────────
  content: {
    padding: 12,
  },
  brandName: {
    fontSize: 10,
    color: '#7C3AED',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 18,
  },
  packSize: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  effectivePrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  gstLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 1,
  },
  mrp: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  stepperRow: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
});
