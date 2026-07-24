/**
 * analytics.api.js — Dashboard analytics API client
 */
import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ag_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const analyticsApi = {
  getKPIs:         (days) => api.get('/dashboard/kpis',         { params: { days } }).then((r) => r.data.data?.[0] || r.data.data),
  getRevenueTrend: (days) => api.get('/dashboard/revenue-trend', { params: { days } }).then((r) => r.data.data),
  getTeam:         (days) => api.get('/dashboard/team',          { params: { days } }).then((r) => r.data.data),
  getTopProducts:  (days, sortBy) => api.get('/dashboard/top-products', { params: { days, sortBy } }).then((r) => r.data.data),
  getOrderStatus:  (days) => api.get('/dashboard/order-status',  { params: { days } }).then((r) => r.data.data),
};
