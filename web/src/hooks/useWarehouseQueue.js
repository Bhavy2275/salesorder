/**
 * useWarehouseQueue.js — React Query hooks for Warehouse Dashboard
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { warehouseApi } from '../api/warehouse.api';
import toast from 'react-hot-toast';

export const warehouseKeys = {
  stats: ['warehouse', 'stats'],
  queue: (filters) => ['warehouse', 'queue', filters],
  detail: (id) => ['warehouse', 'order', id],
};

export function useWarehouseStats() {
  return useQuery({
    queryKey: warehouseKeys.stats,
    queryFn: warehouseApi.getStats,
    refetchInterval: 60 * 1000,          // Auto-refresh every 60s
    staleTime: 30 * 1000,
  });
}

export function useWarehouseQueue(filters = {}) {
  return useQuery({
    queryKey: warehouseKeys.queue(filters),
    queryFn: () => warehouseApi.getQueue(filters),
    refetchInterval: 15 * 1000,          // Live queue: refresh every 15s
    staleTime: 10 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useOrderFulfilmentDetail(orderId) {
  return useQuery({
    queryKey: warehouseKeys.detail(orderId),
    queryFn: () => warehouseApi.getOrderDetail(orderId),
    enabled: Boolean(orderId),
    staleTime: 30 * 1000,
  });
}

export function useTransitionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, status, proofUrl, notes }) =>
      warehouseApi.transitionStatus(orderId, status, { proofUrl, notes }),

    onSuccess: (updatedOrder, variables) => {
      toast.success(`Order ${updatedOrder.order_number} → ${variables.status}`);

      // Invalidate queue and detail caches
      queryClient.invalidateQueries({ queryKey: ['warehouse', 'queue'] });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.detail(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: warehouseKeys.stats });

      // Optimistically update the cached detail
      queryClient.setQueryData(
        warehouseKeys.detail(variables.orderId),
        (old) => old ? { ...old, status: variables.status } : old
      );
    },

    onError: (err) => {
      const msg = err.response?.data?.error || 'Status update failed.';
      toast.error(msg);
    },
  });
}
