import React, { useState } from 'react';
import { store } from '../../store/appStore';
import { format } from 'date-fns';
import { ClipboardList, ChevronRight, Download, Printer } from 'lucide-react';
import { downloadReceiptPdf, printReceipt } from '../../utils/receipt';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function OrderDetail({ order, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-end">
      <div className="h-full w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Order #{order.order_number}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl font-bold">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Client */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Client</p>
            <p className="font-bold text-gray-900">{order.client?.name}</p>
            {order.client?.mobile && <p className="text-sm text-gray-500">Mobile: {order.client.mobile}{order.client.alternate_mobile ? ` · Alt: ${order.client.alternate_mobile}` : ''}</p>}
            {order.client?.gstin && <p className="text-sm text-gray-500">GSTIN: {order.client.gstin}</p>}
            {order.client?.address && <p className="text-sm text-gray-500">{order.client.address}</p>}
            <p className="text-sm text-gray-500">Salesperson: {order.salesperson?.name}</p>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Items ({order.items.length})</p>
            <div className="space-y-2">
              {order.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{it.name}</p>
                    <p className="text-xs text-gray-400">{it.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">×{it.quantity}</p>
                    <p className="text-xs text-gray-400">{fmt(it.price * it.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-violet-50 rounded-xl p-4 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600"><span>Payment</span><span className="font-semibold capitalize">{order.payment_terms?.replace('_', ' ')}</span></div>
            <div className="flex justify-between font-black text-gray-900 text-base">
              <span>Total</span><span className="text-violet-700">{fmt(order.grand_total)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
              📝 {order.notes}
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400">Placed: {format(new Date(order.placed_at), 'dd MMM yyyy, h:mm a')}</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => printReceipt(order)}
              className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold py-3 rounded-xl transition">
              <Printer size={15} /> Print Receipt
            </button>
            <button onClick={() => downloadReceiptPdf(order)}
              className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-bold py-3 rounded-xl transition">
              <Download size={15} /> Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage({ user }) {
  const [orders, setOrders]     = useState(() => store.getOrders());
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState('');

  const query = search.trim().toLowerCase();
  const visible = orders.filter((o) => !query || [o.order_number, o.client?.name, o.client?.gstin, o.items?.map((item) => item.name).join(' ')].some((value) => String(value || '').toLowerCase().includes(query)));

  const selectedOrder = selected ? orders.find((o) => o.id === selected) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelected(null)}
        />
      )}

      <div className="max-w-screen-xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">
            {user?.role === 'warehouse' || user?.role === 'admin' ? 'Order Details' : 'My Orders'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">{orders.length} total orders</p>
        </div>

        <div className="mb-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search party name, GST, bill no. or item name…" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        {/* Orders list */}
        {visible.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 font-medium">{query ? 'No matching orders' : 'No orders here yet'}</p>
            {user?.role === 'salesperson' && <p className="text-sm text-gray-300 mt-1">Place an order from the New Order tab</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((o) => {
              return (
                <div key={o.id} onClick={() => setSelected(o.id)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-violet-200 cursor-pointer transition">
                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                    <div>
                      <p className="font-mono font-bold text-violet-700 text-sm">#{o.order_number}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{format(new Date(o.placed_at), 'dd MMM, h:mm a')}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm truncate">{o.client?.name}</p>
                      <p className="text-xs text-gray-400">{o.client?.gstin || o.salesperson?.name}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-black text-gray-900">{fmt(o.grand_total)}</p>
                      <p className="text-xs text-gray-400">{o.items?.length} items</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
