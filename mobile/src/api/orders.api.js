/**
 * orders.api.js — Order API Client
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from './apiConfig';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function createOrder(orderPayload) {
  const { data } = await api.post('/orders', orderPayload);
  return data.data;
}

export async function sendOTP(orderId, channel = 'sms') {
  const { data } = await api.post(`/orders/${orderId}/otp/send`, { channel });
  return data.data;
}

export async function verifyOTP(orderId, otp, deviceId, geo) {
  const { data } = await api.post(`/orders/${orderId}/otp/verify`, { otp, deviceId, geo });
  return data.data;
}

export async function fetchOrders(params = {}) {
  const { data } = await api.get('/orders', { params });
  return { orders: data.data, pagination: data.meta };
}

export async function fetchOrderDetail(orderId) {
  const { data } = await api.get(`/orders/${orderId}`);
  return data.data;
}

export async function cancelOrder(orderId, reason) {
  const { data } = await api.patch(`/orders/${orderId}/cancel`, { reason });
  return data.data;
}
