/**
 * OrderQueueTable.jsx — Main order queue data table with filters
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { Search, RefreshCw, AlertTriangle, Filter } from 'lucide-react';
import clsx from 'clsx';
import { useWarehouseQueue } from '../../hooks/useWarehouseQueue';
import StatusBadge from './StatusBadge';

const TABS = [
  { value: 'all',        label: 'All Active' },
  { value: 'placed',     label: 'Pending' },
  { value: 'picking',    label: 'Picking' },
  { value: 'packed',     label: 'Packed' },
  { value: 'dispatched', label: 'Dispatched' },
];

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function OrderQueueTable({ onSelectOrder, selectedOrderId }) {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, refetch } = useWarehouseQueue({
    status: activeTab === 'all' ? undefined : activeTab,
    search: search || undefined,
    page,
    limit: 25,
  });

  const orders = data?.orders || [];
  const pagination = data?.pagination;

  const handleTabChange = (tab) => { setActiveTab(tab); setPage(1); };
  const handleSearch = (val) => { setSearch(val); setPage(1); };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50"
            placeholder="Order #, client, salesperson…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <button
          onClick={() => refetch()}
          className={clsx('btn-ghost p-2 rounded-lg', isFetching && 'animate-spin')}
          title="Refresh queue"
        >
          <RefreshCw size={15} />
        </button>

        {isFetching && !isLoading && (
          <span className="text-xs text-violet-500 font-medium animate-pulse">Refreshing…</span>
        )}
      </div>

      {/* ── Status tabs ── */}
      <div className="flex gap-1 px-5 pt-3 pb-0 border-b border-gray-100">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={clsx(
              'px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors',
              activeTab === tab.value
                ? 'text-violet-600 border-violet-600 bg-violet-50/60'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <TableSkeleton />
        ) : orders.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Client</th>
                <th>Salesperson</th>
                <th className="text-center">Items</th>
                <th className="text-right">Total</th>
                <th>Delivery Date</th>
                <th>Status</th>
                <th>Placed At</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => onSelectOrder(order.id)}
                  className={clsx(
                    'cursor-pointer transition-colors',
                    selectedOrderId === order.id && 'bg-violet-50 [&_td]:bg-violet-50'
                  )}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      {order.is_overdue && (
                        <AlertTriangle size={13} className="text-red-500 shrink-0" title="Overdue" />
                      )}
                      <span className="font-mono font-bold text-violet-700 text-xs">
                        #{order.order_number}
                      </span>
                    </div>
                    {order.days_until_delivery !== null && order.days_until_delivery <= 1 && !order.is_overdue && (
                      <p className="text-[10px] text-amber-500 font-semibold mt-0.5">Due soon</p>
                    )}
                  </td>
                  <td>
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{order.client_name}</p>
                    <p className="text-xs text-gray-400">{order.client_mobile}</p>
                  </td>
                  <td>
                    <p className="text-sm text-gray-700">{order.salesperson_name}</p>
                    <p className="text-xs text-gray-400">{order.salesperson_code}</p>
                  </td>
                  <td className="text-center">
                    <span className="font-bold text-gray-700">{order.item_count}</span>
                    <span className="text-xs text-gray-400 ml-1">({order.total_quantity} qty)</span>
                  </td>
                  <td className="text-right font-bold text-gray-800">{formatINR(order.grand_total)}</td>
                  <td>
                    {order.delivery_date
                      ? <span className={clsx('text-sm', order.is_overdue && 'text-red-600 font-semibold')}>
                          {format(new Date(order.delivery_date), 'dd MMM')}
                        </span>
                      : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  <td><StatusBadge status={order.status} /></td>
                  <td className="text-xs text-gray-400">
                    {order.placed_at ? format(new Date(order.placed_at), 'dd MMM, h:mm a') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm">
          <span className="text-gray-500">
            {pagination.total} orders · Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="btn-ghost py-1.5 disabled:opacity-40"
            >← Prev</button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNext}
              className="btn-ghost py-1.5 disabled:opacity-40"
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-5 space-y-3">
      {Array(8).fill(0).map((_, i) => (
        <div key={i} className="shimmer h-12 rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <Filter size={28} className="text-gray-300" />
      </div>
      <p className="font-semibold text-gray-500">No orders in this view</p>
      <p className="text-sm text-gray-400 mt-1">Try changing the status filter or search query.</p>
    </div>
  );
}
