/**
 * StatCards.jsx — KPI summary cards for the warehouse dashboard
 */
import { TrendingUp, ClipboardList, CheckCircle, Boxes } from 'lucide-react';
import clsx from 'clsx';

function StatCard({ label, value, icon: Icon, color, sub, loading }) {
  return (
    <div className="stat-card flex items-start gap-4">
      <div className={clsx('rounded-xl p-3 shrink-0', color)}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
        {loading ? (
          <div className="shimmer h-8 w-16 rounded-lg" />
        ) : (
          <p className="text-3xl font-black text-gray-900 leading-none">{value ?? '—'}</p>
        )}
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function StatCards({ stats, loading }) {
  const formatINR = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total Orders" value={stats?.total_orders} icon={ClipboardList} color="bg-violet-500" loading={loading} />
      <StatCard label="Delivered Today" value={stats?.total_delivered} icon={CheckCircle} color="bg-green-500" loading={loading} />
      <StatCard
        label="Revenue Today"
        value={loading ? null : formatINR(stats?.revenue_today)}
        icon={TrendingUp}
        color="bg-emerald-600"
        loading={loading}
      />
      <StatCard label="Sales Quantity" value={stats?.total_quantity} icon={Boxes} color="bg-blue-500" loading={loading} sub="Units across all orders" />
    </div>
  );
}
