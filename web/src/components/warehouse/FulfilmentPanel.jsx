/**
 * FulfilmentPanel.jsx — Slide-in right panel showing order detail + status actions
 *
 * Opens when a row is clicked in the queue table.
 * Shows: items picking list, client info, timeline, action buttons.
 */
import { X, MapPin, Phone, User, ChevronRight, AlertTriangle, ExternalLink, CheckSquare, Square } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useOrderFulfilmentDetail, useTransitionStatus } from '../../hooks/useWarehouseQueue';
import StatusBadge from './StatusBadge';

const STATUS_FLOW = {
  placed:     { next: 'picking',    label: 'Start Picking',    color: 'btn-primary' },
  picking:    { next: 'packed',     label: 'Mark as Packed',   color: 'btn-primary' },
  packed:     { next: 'dispatched', label: 'Mark Dispatched',  color: 'btn-primary' },
  dispatched: { next: 'delivered',  label: 'Mark Delivered',   color: 'btn-primary' },
};

export default function FulfilmentPanel({ orderId, onClose }) {
  const { data: order, isLoading } = useOrderFulfilmentDetail(orderId);
  const transition = useTransitionStatus();
  const [checked, setChecked] = useState({});
  const [notes, setNotes] = useState('');

  const flow = order ? STATUS_FLOW[order.status] : null;
  const allChecked = order?.items?.length > 0 &&
    order.items.every((i) => checked[i.id]);

  const handleTransition = () => {
    if (!flow || !order) return;
    // Require all items checked before packing
    if (order.status === 'picking' && !allChecked) return;
    transition.mutate({ orderId, status: flow.next, notes: notes || undefined });
  };

  const toggleCheck = (id) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const formatINR = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {isLoading ? <span className="shimmer inline-block w-32 h-6 rounded" /> : `#${order?.order_number}`}
          </h2>
          {order && <StatusBadge status={order.status} size="lg" />}
        </div>
        <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
          <X size={18} />
        </button>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="shimmer h-4 w-48 rounded mb-2 mx-auto" />
            <div className="shimmer h-4 w-32 rounded mx-auto" />
          </div>
        </div>
      )}

      {order && (
        <div className="flex-1 overflow-y-auto">
          {/* ── Client info ── */}
          <div className="px-6 py-4 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Client</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <span className="font-bold text-violet-700 text-sm">
                  {order.client?.business_name?.[0]}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{order.client?.business_name}</p>
                <p className="text-sm text-gray-500">{order.client?.contact_person}</p>
                <div className="flex items-center gap-4 mt-1">
                  <a href={`tel:${order.client?.mobile_primary}`}
                     className="text-xs text-violet-600 flex items-center gap-1 hover:underline">
                    <Phone size={11} /> {order.client?.mobile_primary}
                  </a>
                </div>
              </div>
            </div>

            {order.client?.delivery_address && (
              <div className="mt-3 flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
                <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p>{order.client.delivery_address.line1}{order.client.delivery_address.line2 ? `, ${order.client.delivery_address.line2}` : ''}</p>
                  <p>{order.client.delivery_address.city}, {order.client.delivery_address.state} – {order.client.delivery_address.pincode}</p>
                  {order.client.delivery_address.landmark && (
                    <p className="text-gray-400 text-xs mt-0.5">📍 {order.client.delivery_address.landmark}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Order meta ── */}
          <div className="px-6 py-4 border-b border-gray-50 grid grid-cols-2 gap-3 text-sm">
            <MetaItem label="Salesperson"   value={order.salesperson?.name} />
            <MetaItem label="Payment"        value={order.payment_terms?.replace('_', ' ').toUpperCase()} />
            <MetaItem label="Delivery Date"  value={order.delivery_date ? format(new Date(order.delivery_date), 'dd MMM yyyy') : 'Not set'} />
            <MetaItem label="Order Total"    value={formatINR(order.grand_total)} bold />
            {order.notes && <div className="col-span-2"><MetaItem label="Notes" value={order.notes} /></div>}
          </div>

          {/* ── Picking list ── */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Items to Pick ({order.items?.length})
              </p>
              {order.status === 'picking' && (
                <span className={clsx('text-xs font-semibold',
                  allChecked ? 'text-green-600' : 'text-gray-400')}>
                  {Object.values(checked).filter(Boolean).length}/{order.items?.length} checked
                </span>
              )}
            </div>

            <div className="space-y-2">
              {order.items?.map((item) => (
                <div
                  key={item.id}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                    order.status === 'picking' ? 'cursor-pointer' : '',
                    checked[item.id]
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                  )}
                  onClick={() => order.status === 'picking' && toggleCheck(item.id)}
                >
                  {/* Checkbox (only during picking) */}
                  {order.status === 'picking' && (
                    <div className="shrink-0 text-gray-400">
                      {checked[item.id]
                        ? <CheckSquare size={18} className="text-green-500" />
                        : <Square size={18} />}
                    </div>
                  )}

                  {/* Product image */}
                  {item.product?.images?.[0] && (
                    <img
                      src={item.product.images[0]}
                      alt={item.product_name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm font-semibold leading-tight',
                      checked[item.id] ? 'text-green-700 line-through' : 'text-gray-800')}>
                      {item.product_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.sku_code}
                      {item.product?.barcode && ` • ${item.product.barcode}`}
                    </p>
                    {item.scheme_name && (
                      <span className="text-xs text-violet-600 font-medium">🎁 {item.scheme_name}</span>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-base font-black text-gray-900">×{item.quantity}</p>
                    <p className="text-xs text-gray-400">{item.unit}</p>
                    {item.free_qty > 0 && (
                      <p className="text-xs text-green-600 font-semibold">+{item.free_qty} free</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Fulfilment timeline ── */}
          <Timeline order={order} />

          {/* ── Notes input ── */}
          {flow && (
            <div className="px-6 pb-4">
              <textarea
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Add warehouse notes (optional)..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Footer actions ── */}
      {order && flow && (
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          {order.status === 'picking' && !allChecked && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5 mb-3">
              <AlertTriangle size={12} />
              Check off all items before marking as packed.
            </p>
          )}
          <button
            onClick={handleTransition}
            disabled={transition.isPending || (order.status === 'picking' && !allChecked)}
            className={clsx(
              flow.color,
              'w-full justify-center',
              (transition.isPending || (order.status === 'picking' && !allChecked))
                && 'opacity-50 cursor-not-allowed'
            )}
          >
            {transition.isPending ? 'Updating...' : flow.label}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value, bold }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={clsx('text-gray-800', bold ? 'font-bold text-base' : 'font-medium')}>{value || '—'}</p>
    </div>
  );
}

function Timeline({ order }) {
  const steps = [
    { label: 'Order Placed',   ts: order.placed_at,          status: 'placed' },
    { label: 'Picking Started',ts: order.picking_started_at,  status: 'picking' },
    { label: 'Packed',         ts: order.packed_at,           status: 'packed' },
    { label: 'Dispatched',     ts: order.dispatched_at,       status: 'dispatched' },
    { label: 'Delivered',      ts: order.delivered_at,        status: 'delivered' },
  ];

  const activeIdx = steps.findIndex((s) => s.status === order.status);

  return (
    <div className="px-6 py-4 border-t border-gray-50">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Timeline</p>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />

        <div className="space-y-4">
          {steps.map((step, i) => {
            const done = i <= activeIdx;
            return (
              <div key={step.status} className="flex items-center gap-4 pl-8 relative">
                <div className={clsx(
                  'absolute left-0 w-6 h-6 rounded-full flex items-center justify-center border-2',
                  done
                    ? 'bg-violet-600 border-violet-600'
                    : 'bg-white border-gray-200'
                )}>
                  {done && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <div>
                  <p className={clsx('text-sm font-semibold', done ? 'text-gray-900' : 'text-gray-400')}>
                    {step.label}
                  </p>
                  {step.ts && (
                    <p className="text-xs text-gray-400">
                      {format(new Date(step.ts), 'dd MMM, h:mm a')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
