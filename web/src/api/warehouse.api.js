/**
 * warehouse.api.js — Warehouse API client (Web Admin)
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach stored access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ag_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const warehouseApi = {
  getStats: () =>
    api.get('/warehouse/stats').then((r) => r.data.data),

  getQueue: (params = {}) =>
    api.get('/warehouse/queue', { params }).then((r) => ({
      orders: r.data.data,
      pagination: r.data.meta,
    })),

  getOrderDetail: (orderId) =>
    api.get(`/warehouse/orders/${orderId}`).then((r) => r.data.data),

  transitionStatus: (orderId, status, { proofUrl, notes } = {}) =>
    api.patch(`/warehouse/orders/${orderId}/status`, { status, proofUrl, notes })
       .then((r) => r.data.data),
};
