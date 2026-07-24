/**
 * OrderStatusDonut.jsx — Donut chart for order status breakdown
 */
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const STATUS_COLORS = {
  placed:     '#3B82F6',
  picking:    '#F59E0B',
  packed:     '#F97316',
  dispatched: '#8B5CF6',
  delivered:  '#10B981',
  cancelled:  '#EF4444',
  draft:      '#D1D5DB',
};

const STATUS_LABELS = {
  placed: 'Pending', picking: 'Picking', packed: 'Packed',
  dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled', draft: 'Draft',
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3">
      <p className="text-xs font-semibold text-gray-700">{STATUS_LABELS[name] || name}</p>
      <p className="text-sm font-black text-gray-900">{value} orders</p>
    </div>
  );
}

export default function OrderStatusDonut({ data = [], loading }) {
  const total = data.reduce((s, d) => s + Number(d.count), 0);

  if (loading) return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="shimmer h-6 w-40 rounded mb-6" />
      <div className="shimmer h-52 w-52 rounded-full mx-auto" />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">Order Status Mix</h3>
        <p className="text-xs text-gray-400">{total} total orders in period</p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#D1D5DB'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(val) => (
              <span className="text-xs text-gray-600">{STATUS_LABELS[val] || val}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Centre label */}
      <div className="text-center -mt-2">
        <p className="text-2xl font-black text-gray-900">{total}</p>
        <p className="text-xs text-gray-400">Total Orders</p>
      </div>
    </div>
  );
}
