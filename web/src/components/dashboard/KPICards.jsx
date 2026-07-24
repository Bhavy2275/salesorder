/**
 * KPICards.jsx — 6 summary metric cards for the manager dashboard
 */
import { TrendingUp, TrendingDown, ShoppingCart, Users, Package, IndianRupee, Star } from 'lucide-react';
import clsx from 'clsx';

const INR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const NUM = (n) => new Intl.NumberFormat('en-IN').format(n || 0);

function KPICard({ label, value, icon: Icon, color, trend, trendLabel, loading }) {
  const trendPos = trend > 0;
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
          <Icon size={18} className="text-white" />
        </div>
        {trend !== undefined && !loading && (
          <div className={clsx('flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg',
            trendPos ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
            {trendPos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      {loading
        ? <div className="shimmer h-9 w-28 rounded-lg mb-1" />
        : <p className="text-2xl font-black text-gray-900 leading-none mb-1">{value}</p>
      }
      <p className="text-xs font-medium text-gray-400">{label}</p>
      {trendLabel && <p className="text-[10px] text-gray-300 mt-0.5">{trendLabel}</p>}
    </div>
  );
}

export default function KPICards({ kpis, loading }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <KPICard label="Total Revenue"    value={INR(kpis?.total_revenue)}    icon={IndianRupee}  color="bg-violet-600" trend={kpis?.vs_prev_revenue} trendLabel="vs prior period" loading={loading} />
      <KPICard label="Orders Placed"    value={NUM(kpis?.total_orders)}     icon={ShoppingCart} color="bg-blue-500"   loading={loading} />
      <KPICard label="Avg Order Value"  value={INR(kpis?.avg_order_value)}  icon={Star}         color="bg-amber-500"  loading={loading} />
      <KPICard label="Clients Served"   value={NUM(kpis?.total_clients)}    icon={Users}        color="bg-teal-500"   loading={loading} />
      <KPICard label="New Clients"      value={NUM(kpis?.new_clients)}      icon={Users}        color="bg-cyan-500"   loading={loading} />
      <KPICard label="Items Sold"       value={NUM(kpis?.total_items_sold)} icon={Package}      color="bg-pink-500"   loading={loading} />
    </div>
  );
}
