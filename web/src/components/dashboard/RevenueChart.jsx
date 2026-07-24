/**
 * RevenueChart.jsx — Area + Line combo chart for daily revenue trend (Recharts)
 *
 * Shows: gross revenue area, order count line, on same axis (dual Y).
 * Tooltip shows full date + revenue + orders.
 */
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Line, ComposedChart, Bar,
} from 'recharts';
import { format, parseISO } from 'date-fns';

const INR = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1,
}).format(n || 0);

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-lg p-4 min-w-[200px]">
      <p className="text-xs font-semibold text-gray-500 mb-2">
        {label ? format(parseISO(label), 'EEEE, d MMM yyyy') : ''}
      </p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-xs text-gray-600 capitalize">{p.name}</span>
          </div>
          <span className="text-xs font-bold text-gray-900">
            {p.dataKey === 'gross_revenue' ? INR(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RevenueChart({ data = [], loading }) {
  if (loading) return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="shimmer h-6 w-48 rounded mb-6" />
      <div className="shimmer h-56 w-full rounded-xl" />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-gray-900">Revenue Trend</h3>
          <p className="text-xs text-gray-400">Daily gross revenue & order volume</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis
            dataKey="date_day"
            tickFormatter={(d) => format(parseISO(d), 'd MMM')}
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="revenue"
            orientation="left"
            tickFormatter={INR}
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(val) => <span className="text-xs text-gray-500 capitalize">{val.replace('_', ' ')}</span>}
          />
          <Area
            yAxisId="revenue"
            type="monotone"
            dataKey="gross_revenue"
            name="Revenue"
            stroke="#7C3AED"
            strokeWidth={2.5}
            fill="url(#revenueGrad)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Bar
            yAxisId="orders"
            dataKey="order_count"
            name="Orders"
            fill="#E0E7FF"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
