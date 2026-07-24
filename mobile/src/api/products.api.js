/**
 * products.api.js — Product Catalogue API Client
 *
 * Wraps Axios calls to the Anti Gravity backend.
 * Handles auth headers, error parsing, and offline fallback.
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Products API ─────────────────────────────────────────────────────────────

/**
 * Fetch paginated product list.
 * @param {object} params - Filter/search/sort params
 */
export async function fetchProducts(params = {}) {
  const { data } = await api.get('/products', { params });
  return {
    products: data.data,
    pagination: data.meta,
  };
}

/**
 * Fetch a single product by ID.
 * @param {string} productId
 */
export async function fetchProduct(productId) {
  const { data } = await api.get(`/products/${productId}`);
  return data.data;
}

/**
 * Fetch all categories (hierarchical tree).
 */
export async function fetchCategories() {
  const { data } = await api.get('/products/meta/categories');
  return data.data;
}

/**
 * Fetch all brands.
 */
export async function fetchBrands() {
  const { data } = await api.get('/products/meta/brands');
  return data.data;
}
