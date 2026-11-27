/**
 * WarehouseDashboard.jsx — Main Warehouse Dashboard Page
 *
 * Layout:
 * ┌────────────────────────────────────────────────┐
 * │  Header: "Warehouse Dashboard"   🔴 Live badge  │
 * ├────────────────────────────────────────────────┤
 * │  Stat cards row (6 KPIs)                        │
 * ├──────────────────────────────┬─────────────────┤
 * │  Order Queue Table           │ Fulfilment Panel  │
 * │  (click row to open panel →) │  (slide in)      │
 * └──────────────────────────────┴─────────────────┘
 */
import { useState } from 'react';
import { Warehouse } from 'lucide-react';
import { format } from 'date-fns';
import { useWarehouseStats } from '../../hooks/useWarehouseQueue';
import StatCards from '../../components/warehouse/StatCards';
import OrderQueueTable from '../../components/warehouse/OrderQueueTable';

export default function WarehouseDashboard() {
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const { data: stats, isLoading: statsLoading } = useWarehouseStats();

  const handleSelectOrder = (id) => {
    if (!id) { setSelectedOrderId(null); return; }
    setSelectedOrderId((prev) => (prev === id ? null : id)); // Toggle
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Top navbar ── */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
            <Warehouse size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-900 leading-none">Sales Order</h1>
            <p className="text-xs text-gray-400">Warehouse Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-700">{format(new Date(), 'EEEE, d MMMM')}</p>
            <p className="text-xs text-gray-400">{format(new Date(), 'h:mm a')}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-5 p-6 max-w-screen-2xl mx-auto w-full">
        {/* ── KPI Cards ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              Today's Overview
            </h2>
            <span className="text-xs text-gray-400">Auto-refreshes every minute</span>
          </div>
          <StatCards stats={stats} loading={statsLoading} />
        </section>

        <section className="flex-1 min-h-0">
          <OrderQueueTable onSelectOrder={handleSelectOrder} selectedOrderId={selectedOrderId} />
        </section>
      </main>
    </div>
  );
}
