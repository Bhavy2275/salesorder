/**
 * SalesDashboard.jsx — Manager Sales Analytics Dashboard
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────┐
 * │  Header: period selector (7d / 30d / 90d)            │
 * ├──────────────────────────────────────────────────────┤
 * │  KPI Cards row (6 metrics)                           │
 * ├─────────────────────────────┬────────────────────────┤
 * │  Revenue + Orders chart     │  Order Status Donut    │
 * ├─────────────────────────────┴────────────────────────┤
 * │  Top Products bar chart    │  Team Leaderboard        │
 * └────────────────────────────┴─────────────────────────┘
 */
import { useState } from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  useKPIs, useRevenueTrend, useTeamPerformance,
  useTopProducts, useOrderStatus,
} from '../../hooks/useAnalytics';
import KPICards        from '../../components/dashboard/KPICards';
import RevenueChart    from '../../components/dashboard/RevenueChart';
import OrderStatusDonut from '../../components/dashboard/OrderStatusDonut';
import TopProductsChart from '../../components/dashboard/TopProductsChart';
import TeamLeaderboard  from '../../components/dashboard/TeamLeaderboard';

const PERIOD_OPTIONS = [
  { value: 7,   label: '7D' },
  { value: 30,  label: '30D' },
  { value: 90,  label: '90D' },
  { value: 180, label: '6M' },
];

export default function SalesDashboard() {
  const [days, setDays]       = useState(30);
  const [sortBy, setSortBy]   = useState('revenue');
  const queryClient           = useQueryClient();

  const { data: kpis,     isLoading: kpiLoading }     = useKPIs(days);
  const { data: trend,    isLoading: trendLoading }    = useRevenueTrend(days);
  const { data: team,     isLoading: teamLoading }     = useTeamPerformance(days);
  const { data: products, isLoading: productLoading }  = useTopProducts(days, 10, sortBy);
  const { data: statuses, isLoading: statusLoading }   = useOrderStatus(days);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['dash'] });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
              <BarChart2 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900 leading-none">Sales Order</h1>
              <p className="text-xs text-gray-400">Sales Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period selector */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={clsx(
                    'px-4 py-1.5 text-sm font-semibold rounded-lg transition-all',
                    days === opt.value
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button onClick={refresh} className="btn-ghost p-2.5 rounded-xl" title="Refresh data">
              <RefreshCw size={15} />
            </button>

            <div className="text-right hidden md:block">
              <p className="text-xs font-semibold text-gray-700">{format(new Date(), 'EEEE, d MMM yyyy')}</p>
              <p className="text-xs text-gray-400">Last {days} days</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-5">
        {/* ── KPIs ── */}
        <KPICards kpis={kpis} loading={kpiLoading} />

        {/* ── Revenue + Status mix ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2">
            <RevenueChart data={trend || []} loading={trendLoading} />
          </div>
          <div>
            <OrderStatusDonut data={statuses || []} loading={statusLoading} />
          </div>
        </div>

        {/* ── Top products + Team leaderboard ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <TopProductsChart
            data={products || []}
            loading={productLoading}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
          <TeamLeaderboard data={team || []} loading={teamLoading} />
        </div>
      </main>
    </div>
  );
}
