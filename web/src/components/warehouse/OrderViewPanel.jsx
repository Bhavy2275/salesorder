import { useOrderFulfilmentDetail } from '../../hooks/useWarehouseQueue';
import { X } from 'lucide-react';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

export default function OrderViewPanel({ orderId, onClose }) {
  const { data: order, isLoading, isError } = useOrderFulfilmentDetail(orderId);
  return (
    <section className="border-t border-gray-100 p-5 bg-gray-50" aria-live="polite">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900">Order details</h3>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700" aria-label="Close order details"><X size={17} /></button>
      </div>
      {isLoading ? <p className="text-sm text-gray-500">Loading order…</p> : isError ? <p className="text-sm text-red-600">Could not load this order.</p> : order && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="space-y-1">
            <p className="font-semibold text-gray-900">#{order.order_number} · {order.client?.business_name}</p>
            <p className="text-gray-600">{order.client?.mobile_primary}</p>
            <p className="text-gray-600">{order.client?.gst_number || 'GST not provided'}</p>
            <p className="text-gray-600">{typeof order.client?.delivery_address === 'string' ? order.client.delivery_address : [order.client?.delivery_address?.line1, order.client?.delivery_address?.line2, order.client?.delivery_address?.city, order.client?.delivery_address?.state, order.client?.delivery_address?.pincode].filter(Boolean).join(', ')}</p>
            <p className="text-gray-600">Payment: {String(order.payment_terms || '—').replaceAll('_', ' ')}</p>
          </div>
          <div className="lg:col-span-2 space-y-2">
            {(order.items || []).map((item) => <div key={item.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2"><span>{item.product_name} <span className="text-gray-400">× {item.quantity} {item.unit}</span></span><span className="font-semibold">{money(item.line_total)}</span></div>)}
            <p className="text-right font-black text-gray-900">Total {money(order.grand_total)}</p>
          </div>
        </div>
      )}
    </section>
  );
}
