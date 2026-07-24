/**
 * useAnalytics.js — React Query hooks for the Sales Dashboard
 */
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics.api';

const STALE = 5 * 60 * 1000;  // 5 min

export const useKPIs           = (days) => useQuery({ queryKey: ['dash', 'kpis', days],    queryFn: () => analyticsApi.getKPIs(days),                staleTime: STALE });
export const useRevenueTrend   = (days) => useQuery({ queryKey: ['dash', 'trend', days],   queryFn: () => analyticsApi.getRevenueTrend(days),        staleTime: STALE });
export const useTeamPerformance= (days) => useQuery({ queryKey: ['dash', 'team', days],    queryFn: () => analyticsApi.getTeam(days),                staleTime: STALE });
export const useTopProducts    = (days, sortBy) => useQuery({ queryKey: ['dash', 'top', days, sortBy], queryFn: () => analyticsApi.getTopProducts(days, sortBy), staleTime: STALE });
export const useOrderStatus    = (days) => useQuery({ queryKey: ['dash', 'status', days],  queryFn: () => analyticsApi.getOrderStatus(days),         staleTime: STALE });
