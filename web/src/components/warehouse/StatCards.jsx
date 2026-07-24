/**
 * StatCards.jsx — KPI summary cards for the warehouse dashboard
 */
import { TrendingUp, Clock, Package, Truck, CheckCircle, AlertTriangle } from 'lucide-react';
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

  const avgMins = stats?.avg_fulfil_mins ? Math.round(stats.avg_fulfil_mins) : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard label="Pending"    value={stats?.total_placed}     icon={Clock}         color="bg-blue-500"    loading={loading} />
      <StatCard label="Picking"    value={stats?.total_picking}    icon={Package}       color="bg-amber-500"   loading={loading} />
      <StatCard label="Packed"     value={stats?.total_packed}     icon={Package}       color="bg-orange-500"  loading={loading} />
      <StatCard label="Dispatched" value={stats?.total_dispatched} icon={Truck}         color="bg-violet-500"  loading={loading} />
      <StatCard label="Delivered"  value={stats?.total_delivered}  icon={CheckCircle}   color="bg-green-500"   loading={loading} sub="Today" />
      <StatCard
        label="Revenue Today"
        value={loading ? null : formatINR(stats?.revenue_today)}
        icon={TrendingUp}
        color="bg-emerald-600"
        loading={loading}
        sub={avgMins ? `Avg ${avgMins}m to dispatch` : undefined}
      />
    </div>
  );
}
