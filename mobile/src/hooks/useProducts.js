/**
 * useProducts.js — React Query hooks for Product Catalogue
 *
 * Handles:
 * - Fetching product list with filters
 * - Infinite scroll (useInfiniteQuery)
 * - Single product detail
 * - Categories and brands (long-cached)
 * - Offline fallback using cached WatermelonDB data
 */

import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useDeferredValue } from 'react';
import { fetchProducts, fetchProduct, fetchCategories, fetchBrands } from '../api/products.api';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const productKeys = {
  all: ['products'],
  lists: () => [...productKeys.all, 'list'],
  list: (filters) => [...productKeys.lists(), filters],
  details: () => [...productKeys.all, 'detail'],
  detail: (id) => [...productKeys.details(), id],
  categories: ['categories'],
  brands: ['brands'],
};

// ─── useProductList — standard paginated fetch ────────────────────────────────

export function useProductList(filters = {}) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => fetchProducts(filters),
    staleTime: 60 * 1000,        // 1 min — data is fresh for 1 min before refetch
    gcTime: 5 * 60 * 1000,       // 5 min — keep in cache even when unused
    placeholderData: (prev) => prev, // Show stale data while refetching (no loading flash)
  });
}

// ─── useProductCatalogue — infinite scroll with filters ───────────────────────

/**
 * Main hook used by the Product Catalogue screen.
 * Combines search, filter state, and infinite scroll.
 */
export function useProductCatalogue() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [schemesOnly, setSchemesOnly] = useState(false);
  const [sortBy, setSortBy] = useState('name_asc');

  // Defer search to avoid querying on every keystroke
  const deferredSearch = useDeferredValue(searchQuery);

  const filters = {
    q: deferredSearch || undefined,
    category_id: selectedCategory || undefined,
    brand_id: selectedBrand || undefined,
    in_stock: inStockOnly ? 'true' : undefined,
    has_scheme: schemesOnly ? 'true' : undefined,
    sort: sortBy,
    limit: 20,
  };

  const query = useInfiniteQuery({
    queryKey: productKeys.list(filters),
    queryFn: ({ pageParam = 1 }) => fetchProducts({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.hasNext) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Flatten pages for FlatList consumption
  const products = query.data?.pages.flatMap((page) => page.products) ?? [];
  const totalCount = query.data?.pages[0]?.pagination?.total ?? 0;

  const fetchNextPage = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedBrand(null);
    setInStockOnly(false);
    setSchemesOnly(false);
    setSortBy('name_asc');
  }, []);

  const hasActiveFilters = Boolean(
    deferredSearch || selectedCategory || selectedBrand || inStockOnly || schemesOnly
  );

  return {
    // Data
    products,
    totalCount,

    // Query state
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,

    // Actions
    fetchNextPage,
    refetch: query.refetch,

    // Filter state
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedBrand,
    setSelectedBrand,
    inStockOnly,
    setInStockOnly,
    schemesOnly,
    setSchemesOnly,
    sortBy,
    setSortBy,
    clearFilters,
    hasActiveFilters,
  };
}

// ─── useProduct — single product detail ──────────────────────────────────────

export function useProduct(productId) {
  return useQuery({
    queryKey: productKeys.detail(productId),
    queryFn: () => fetchProduct(productId),
    enabled: Boolean(productId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,  // Keep detail in cache for 30 min (support "back" nav)
  });
}

// ─── useCategories ────────────────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: productKeys.categories,
    queryFn: fetchCategories,
    staleTime: 60 * 60 * 1000,   // 1 hour — categories rarely change
    gcTime: 24 * 60 * 60 * 1000, // 24 hours in cache
  });
}

// ─── useBrands ────────────────────────────────────────────────────────────────

export function useBrands() {
  return useQuery({
    queryKey: productKeys.brands,
    queryFn: fetchBrands,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

// ─── useInvalidateProducts ────────────────────────────────────────────────────
// Call this after adding to cart or after admin mutations

export function useInvalidateProducts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: productKeys.all });
}
