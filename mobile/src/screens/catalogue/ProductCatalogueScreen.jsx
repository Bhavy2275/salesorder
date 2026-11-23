/**
 * ProductCatalogueScreen.jsx — Main Catalogue Screen
 *
 * Layout:
 * ┌─────────────────────────────────┐
 * │  Header: "Catalogue"  🛒 badge  │
 * │  SearchBar                      │
 * │  CategoryFilterBar (scroll →)   │
 * │  Sort row + filter count        │
 * ├─────────────────────────────────┤
 * │  2-column product grid          │
 * │  (FlatList, infinite scroll)    │
 * ├─────────────────────────────────┤
 * │  [Cart FAB]                     │
 * └─────────────────────────────────┘
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable,
  StyleSheet, ActivityIndicator, RefreshControl,
  StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, interpolate,
} from 'react-native-reanimated';

import ProductCard from '../../components/catalogue/ProductCard';
import CategoryFilterBar from '../../components/catalogue/CategoryFilterBar';
import CartFAB from '../../components/catalogue/CartFAB';
import { useProductCatalogue, useCategories } from '../../hooks/useProducts';
import { useCartStore } from '../../store/cartStore';

// Sort options for the bottom sheet / dropdown
const SORT_OPTIONS = [
  { value: 'name_asc',   label: 'Name A–Z' },
  { value: 'name_desc',  label: 'Name Z–A' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest',     label: 'Newest First' },
];

export default function ProductCatalogueScreen() {
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Data + filter state from hook
  const {
    products,
    totalCount,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isError,
    hasNextPage,
    fetchNextPage,
    refetch,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    inStockOnly,
    setInStockOnly,
    schemesOnly,
    setSchemesOnly,
    sortBy,
    setSortBy,
    clearFilters,
    hasActiveFilters,
  } = useProductCatalogue();

  const { data: categories = [] } = useCategories();
  const cartItemCount = useCartStore((s) => s.items.length);

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderProduct = useCallback(
    ({ item }) => <ProductCard product={item} />,
    []
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return <View style={{ height: 100 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#7C3AED" />
        <Text style={styles.footerLoaderText}>Loading more...</Text>
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>No products found</Text>
        <Text style={styles.emptySubtitle}>
          {hasActiveFilters
            ? 'Try adjusting your filters or search term'
            : 'No products available yet'}
        </Text>
        {hasActiveFilters && (
          <Pressable onPress={clearFilters} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear Filters</Text>
          </Pressable>
        )}
      </View>
    );
  }, [isLoading, hasActiveFilters, clearFilters]);

  const renderSeparator = useCallback(() => <View style={{ width: 16 }} />, []);

  // ─── Header component (rendered above the FlatList) ───────────────────────
  const ListHeader = (
    <View>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </View>

        {/* Filter toggle */}
        <Pressable
          onPress={() => setInStockOnly((v) => !v)}
          style={[styles.filterBtn, inStockOnly && styles.filterBtnActive]}
        >
          <Ionicons
            name="filter-outline"
            size={18}
            color={inStockOnly ? '#7C3AED' : '#6B7280'}
          />
          {inStockOnly && <View style={styles.filterActiveDot} />}
        </Pressable>
      </View>

      {/* Category filter bar */}
      <CategoryFilterBar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        schemesOnly={schemesOnly}
        onToggleSchemes={() => setSchemesOnly((v) => !v)}
      />

      {/* Results row */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsCount}>
          {isFetching && !isLoading ? '↻ ' : ''}
          {totalCount.toLocaleString('en-IN')} product{totalCount !== 1 ? 's' : ''}
          {hasActiveFilters ? ' (filtered)' : ''}
        </Text>

        {/* Sort picker */}
        <Pressable
          onPress={() => setShowSortMenu((v) => !v)}
          style={styles.sortBtn}
        >
          <Ionicons name="swap-vertical-outline" size={14} color="#7C3AED" />
          <Text style={styles.sortBtnText}>
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Sort'}
          </Text>
        </Pressable>
      </View>

      {/* Sort menu dropdown */}
      {showSortMenu && (
        <View style={styles.sortMenu}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => { setSortBy(opt.value); setShowSortMenu(false); }}
              style={[styles.sortOption, sortBy === opt.value && styles.sortOptionActive]}
            >
              <Text style={[styles.sortOptionText, sortBy === opt.value && styles.sortOptionTextActive]}>
                {opt.label}
              </Text>
              {sortBy === opt.value && (
                <Ionicons name="checkmark" size={16} color="#7C3AED" />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <AppHeader cartCount={cartItemCount} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Loading catalogue...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────
  if (isError) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <AppHeader cartCount={cartItemCount} />
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={64} color="#EF4444" />
          <Text style={styles.emptyTitle}>Failed to load products</Text>
          <Text style={styles.emptySubtitle}>Check your connection and try again.</Text>
          <Pressable onPress={() => refetch()} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* App Header */}
      <AppHeader cartCount={cartItemCount} />

      {/* Product Grid */}
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={fetchNextPage}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isFetchingNextPage}
            onRefresh={refetch}
            tintColor="#7C3AED"
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        windowSize={5}
      />

      {/* Cart FAB */}
      <CartFAB />
    </SafeAreaView>
  );
}

// ─── App Header ───────────────────────────────────────────────────────────────
function AppHeader({ cartCount }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>Product Catalogue</Text>
        <Text style={styles.headerSubtitle}>Browse and add to order</Text>
      </View>

      <View style={styles.headerActions}>
        {/* Cart icon */}
        <Pressable style={styles.headerIconBtn} onPress={() => router.push('/cart')}>
          <Ionicons name="cart-outline" size={24} color="#1F2937" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  filterBtnActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
  },

  // Results row
  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsCount: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sortBtnText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '600',
  },

  // Sort menu
  sortMenu: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  sortOptionActive: {
    backgroundColor: '#F5F3FF',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  // Grid
  columnWrapper: {
    paddingHorizontal: 16,
    gap: 16,
  },
  listContent: {
    paddingBottom: 120,
  },

  // Footer
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    color: '#9CA3AF',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  clearBtn: {
    marginTop: 20,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  clearBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
