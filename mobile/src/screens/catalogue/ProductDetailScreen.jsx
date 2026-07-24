/**
 * ProductDetailScreen.jsx — Full product detail page
 *
 * Layout:
 * ┌─────────────────────────────────┐
 * │  Image carousel (swipeable)     │
 * │  Brand • Category chip          │
 * │  Product name                   │
 * │  Stock badge + pack size        │
 * │  Pricing section (tier prices)  │
 * │  Scheme info card               │
 * │  GST breakdown                  │
 * │  Description                    │
 * │  Large quantity stepper + Add   │
 * └─────────────────────────────────┘
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Dimensions, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import StockBadge from '../../components/catalogue/StockBadge';
import QuantityStepper from '../../components/catalogue/QuantityStepper';
import CartFAB from '../../components/catalogue/CartFAB';
import { useProduct } from '../../hooks/useProducts';
import { useCartStore } from '../../store/cartStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/600x400/EDE9FE/7C3AED?text=Anti+Gravity';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const { data: product, isLoading, isError, refetch } = useProduct(id);

  const addToCart = useCartStore((s) => s.addToCart);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const getItemQty = useCartStore((s) => s.getItemQty);

  const quantity = product ? getItemQty(product.id) : 0;
  const isOutOfStock = product?.stock_status === 'out_of_stock' && !product?.allow_backorder;

  const formatPrice = (price) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);

  const handleAdd = useCallback(() => {
    if (!product || isOutOfStock) return;
    addToCart(product, 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [product, isOutOfStock, addToCart]);

  const handleSetQty = useCallback((qty) => {
    if (!product) return;
    setQuantity(product.id, qty);
  }, [product, setQuantity]);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Header />
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading product...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (isError || !product) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Header />
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Product not found</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const images = product.images?.length > 0 ? product.images : [PLACEHOLDER_IMAGE];
  const gstAmount = (product.effective_price * product.gst_percent) / 100;
  const priceIncGst = product.effective_price + gstAmount;
  const discountPct = product.mrp > product.effective_price
    ? Math.round(((product.mrp - product.effective_price) / product.mrp) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <Header />

      <ScrollView showsVerticalScrollIndicator={false} bounces>
        {/* ── Image Section ──────────────────────────────────────────────────── */}
        <View style={styles.imageSection}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActiveImageIndex(index);
            }}
          >
            {images.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={styles.productImage}
                contentFit="contain"
                transition={200}
              />
            ))}
          </ScrollView>

          {/* Scheme ribbon */}
          {product.scheme?.ribbon_text && (
            <View style={styles.ribbon}>
              <Text style={styles.ribbonText}>{product.scheme.ribbon_text}</Text>
            </View>
          )}

          {/* Discount badge */}
          {discountPct > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discountPct}% OFF</Text>
            </View>
          )}

          {/* Image dots */}
          {images.length > 1 && (
            <View style={styles.imageDots}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === activeImageIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Product Info ───────────────────────────────────────────────────── */}
        <View style={styles.infoSection}>
          {/* Brand + Category */}
          <View style={styles.metaRow}>
            {product.brand?.name && (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{product.brand.name}</Text>
              </View>
            )}
            {product.category?.name && (
              <View style={[styles.metaChip, styles.metaChipSecondary]}>
                <Text style={[styles.metaChipText, { color: '#6B7280' }]}>
                  {product.category.name}
                </Text>
              </View>
            )}
          </View>

          {/* Product name */}
          <Text style={styles.productName}>{product.name}</Text>

          {/* SKU + pack size */}
          <Text style={styles.skuText}>
            SKU: {product.sku_code}
            {product.pack_size ? ` • ${product.pack_size}` : ''}
            {` • per ${product.unit}`}
          </Text>

          {/* Stock badge */}
          <View style={styles.stockRow}>
            <StockBadge
              status={product.stock_status}
              qty={product.stock_qty <= product.low_stock_threshold ? product.stock_qty : undefined}
              size="md"
            />
            {product.stock_qty > 0 && (
              <Text style={styles.stockQtyText}>
                {product.stock_qty} {product.unit}{product.stock_qty !== 1 ? 's' : ''} available
              </Text>
            )}
          </View>

          {/* ── Pricing Card ──────────────────────────────────────────────────── */}
          <View style={styles.pricingCard}>
            <View style={styles.pricingHeader}>
              <View>
                <Text style={styles.effectivePriceLabel}>Your Price (ex-GST)</Text>
                <Text style={styles.effectivePrice}>
                  {formatPrice(product.effective_price)}
                </Text>
              </View>

              {product.mrp > product.effective_price && (
                <View style={styles.savingsChip}>
                  <Text style={styles.savingsText}>
                    Save {formatPrice(product.mrp - product.effective_price)}
                  </Text>
                </View>
              )}
            </View>

            {/* GST breakdown */}
            <View style={styles.gstRow}>
              <Text style={styles.gstText}>
                + GST ({product.gst_percent}%)
              </Text>
              <Text style={styles.gstAmount}>+{formatPrice(gstAmount)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Price inc. GST</Text>
              <Text style={styles.totalPrice}>{formatPrice(priceIncGst)}</Text>
            </View>

            {product.mrp !== product.effective_price && (
              <Text style={styles.mrpText}>
                MRP {formatPrice(product.mrp)} (incl. all taxes)
              </Text>
            )}
          </View>

          {/* ── Active Scheme Card ────────────────────────────────────────────── */}
          {product.scheme && (
            <View style={styles.schemeCard}>
              <View style={styles.schemeHeader}>
                <Ionicons name="gift-outline" size={20} color="#7C3AED" />
                <Text style={styles.schemeName}>{product.scheme.name}</Text>
              </View>

              {product.scheme.scheme_type === 'quantity_based' && (
                <Text style={styles.schemeDetail}>
                  Buy {product.scheme.buy_quantity} {product.unit}s,
                  get {product.scheme.free_quantity} FREE automatically added to your order.
                </Text>
              )}

              {product.scheme.scheme_type === 'percentage' && (
                <Text style={styles.schemeDetail}>
                  {product.scheme.discount_percent}% discount applied at checkout.
                </Text>
              )}

              {product.scheme.valid_until && (
                <Text style={styles.schemeExpiry}>
                  ⏰ Valid until {new Date(product.scheme.valid_until).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </Text>
              )}

              {/* Progress bar for "how close am I to triggering the scheme" */}
              {product.scheme.scheme_type === 'quantity_based' && quantity > 0 && (
                <SchemeProgressBar
                  current={quantity}
                  target={product.scheme.buy_quantity}
                  freeQty={product.scheme.free_quantity}
                />
              )}
            </View>
          )}

          {/* ── Description ───────────────────────────────────────────────────── */}
          {product.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>About this product</Text>
              <Text style={styles.descriptionText}>{product.description}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom CTA ─────────────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        {quantity > 0 ? (
          <View style={styles.bottomBarWithQty}>
            <QuantityStepper
              quantity={quantity}
              onAdd={() => setQuantity(product.id, quantity + 1)}
              onRemove={() => setQuantity(product.id, quantity - 1)}
              maxQty={product.allow_backorder ? undefined : product.stock_qty}
              size="lg"
            />
            <View style={styles.bottomBarInfo}>
              <Text style={styles.cartQtyLabel}>In cart</Text>
              <Text style={styles.cartTotal}>
                {formatPrice(quantity * product.effective_price)}
              </Text>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={handleAdd}
            disabled={isOutOfStock}
            style={({ pressed }) => [
              styles.addToCartBtn,
              pressed && styles.addToCartBtnPressed,
              isOutOfStock && styles.addToCartBtnDisabled,
            ]}
          >
            <Ionicons name="cart-outline" size={20} color="#fff" />
            <Text style={styles.addToCartBtnText}>
              {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </Text>
          </Pressable>
        )}
      </View>

      <CartFAB />
    </SafeAreaView>
  );
}

// ─── Scheme Progress Bar ─────────────────────────────────────────────────────
function SchemeProgressBar({ current, target, freeQty }) {
  const progress = Math.min(current / target, 1);
  const completedCycles = Math.floor(current / target);
  const remaining = target - (current % target || target);

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {completedCycles > 0
          ? `🎉 ${completedCycles * freeQty} free item${completedCycles * freeQty > 1 ? 's' : ''} earned! Add ${remaining} more for another.`
          : `Add ${remaining} more to get ${freeQty} free!`}
      </Text>
    </View>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header() {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="chevron-back" size={22} color="#1F2937" />
      </Pressable>
      <Text style={styles.headerTitle}>Product Details</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Image
  imageSection: {
    backgroundColor: '#fff',
    position: 'relative',
  },
  productImage: {
    width: SCREEN_WIDTH,
    height: 300,
    backgroundColor: '#F5F3FF',
  },
  ribbon: {
    position: 'absolute',
    top: 16,
    left: 0,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  ribbonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  discountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  discountText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  imageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: '#7C3AED',
    width: 16,
  },

  // Info
  infoSection: { padding: 16 },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metaChip: {
    backgroundColor: '#EDE9FE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaChipSecondary: { backgroundColor: '#F3F4F6' },
  metaChipText: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  productName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 28,
    marginBottom: 6,
  },
  skuText: { fontSize: 12, color: '#9CA3AF', marginBottom: 12 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  stockQtyText: { fontSize: 12, color: '#6B7280' },

  // Pricing card
  pricingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pricingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  effectivePriceLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  effectivePrice: { fontSize: 28, fontWeight: '900', color: '#111827' },
  savingsChip: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  savingsText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  gstRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gstText: { fontSize: 13, color: '#6B7280' },
  gstAmount: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 10 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  totalPrice: { fontSize: 18, fontWeight: '800', color: '#111827' },
  mrpText: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },

  // Scheme card
  schemeCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
  },
  schemeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  schemeName: { fontSize: 15, fontWeight: '700', color: '#4C1D95' },
  schemeDetail: { fontSize: 13, color: '#5B21B6', lineHeight: 18 },
  schemeExpiry: { fontSize: 11, color: '#7C3AED', marginTop: 6, fontWeight: '500' },

  // Progress
  progressContainer: { marginTop: 12 },
  progressBar: {
    height: 6,
    backgroundColor: '#DDD6FE',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },
  progressText: { fontSize: 12, color: '#5B21B6', fontWeight: '500' },

  // Description
  descriptionSection: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  descriptionText: { fontSize: 14, color: '#6B7280', lineHeight: 22 },

  // Bottom bar
  bottomBar: {
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  bottomBarWithQty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bottomBarInfo: { flex: 1 },
  cartQtyLabel: { fontSize: 11, color: '#9CA3AF' },
  cartTotal: { fontSize: 18, fontWeight: '800', color: '#111827' },
  addToCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  addToCartBtnPressed: { opacity: 0.85 },
  addToCartBtnDisabled: { backgroundColor: '#D1D5DB' },
  addToCartBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },

  // Utils
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#9CA3AF', fontSize: 14 },
  errorText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  retryBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#fff', fontWeight: '700' },
});
