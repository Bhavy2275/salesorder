/**
 * TopProductsChart.jsx — Horizontal bar chart for top selling products
 */
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import clsx from 'clsx';

const INR = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1,
}).format(n || 0);

const SORT_OPTIONS = [
  { value: 'revenue',  label: 'By Revenue' },
  { value: 'quantity', label: 'By Quantity' },
];

const GRADIENT_COLORS = [
  '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD',
  '#6366F1', '#818CF8', '#93C5FD', '#60A5FA', '#34D399', '#6EE7B7',
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 max-w-[200px]">
      <p className="text-xs font-bold text-gray-800 mb-1 leading-tight">{d.product_name}</p>
      <p className="text-[10px] text-gray-400 mb-2">{d.sku_code}</p>
      <p className="text-xs text-gray-600">Revenue: <span className="font-bold">{INR(d.total_revenue)}</span></p>
      <p className="text-xs text-gray-600">Qty sold: <span className="font-bold">{d.total_qty}</span></p>
      <p className="text-xs text-gray-600">Orders: <span className="font-bold">{d.total_orders}</span></p>
    </div>
  );
}

export default function TopProductsChart({ data = [], loading, sortBy, onSortChange }) {
  const displayData = data.map((d) => ({
    ...d,
    short_name: d.product_name?.length > 20 ? d.product_name.slice(0, 18) + '…' : d.product_name,
  }));

  if (loading) return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="shimmer h-6 w-44 rounded mb-6" />
      <div className="shimmer h-72 w-full rounded-xl" />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900">Top Products</h3>
          <p className="text-xs text-gray-400">Best performers in selected period</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortChange(opt.value)}
              className={clsx(
                'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                sortBy === opt.value
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={displayData}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={sortBy === 'revenue' ? INR : undefined}
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="short_name"
            tick={{ fontSize: 11, fill: '#374151' }}
            axisLine={false}
            tickLine={false}
            width={130}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey={sortBy === 'revenue' ? 'total_revenue' : 'total_qty'}
            radius={[0, 6, 6, 0]}
            maxBarSize={22}
            label={{
              position: 'right',
              formatter: (v) => sortBy === 'revenue' ? INR(v) : v,
              fontSize: 10,
              fill: '#9CA3AF',
            }}
          >
            {displayData.map((_, i) => (
              <Cell key={i} fill={GRADIENT_COLORS[i % GRADIENT_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
