import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Agentation } from 'agentation';
import {
  BarChart2, Warehouse, Package, ShoppingCart,
  ClipboardList, LogOut, ShoppingBag,
} from 'lucide-react';

import { authStore }         from './store/authStore';
import LoginPage             from './pages/auth/LoginPage';
import SalesDashboard        from './pages/dashboard/SalesDashboard';
import WarehouseDashboard    from './pages/warehouse/WarehouseDashboard';
import ProductsPage          from './pages/products/ProductsPage';
import NewOrderPage          from './pages/orders/NewOrderPage';
import OrdersPage            from './pages/orders/OrdersPage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// ─── Nav config per role ─────────────────────────────────────────────────────
const NAV = {
  admin: [
    { to: '/',          label: 'Dashboard', icon: BarChart2 },
    { to: '/products',  label: 'Products',  icon: Package },
    { to: '/orders',    label: 'Orders',    icon: ClipboardList },
    { to: '/warehouse', label: 'Warehouse', icon: Warehouse },
  ],
  salesperson: [
    { to: '/new-order', label: 'New Order', icon: ShoppingCart },
    { to: '/orders',    label: 'My Orders', icon: ClipboardList },
  ],
  warehouse: [
    { to: '/orders',    label: 'Order Queue',icon: ClipboardList },
    { to: '/warehouse', label: 'Fulfilment', icon: Warehouse },
  ],
};

function AppShell({ user, onLogout }) {
  const nav = NAV[user.role] || NAV.salesperson;

  // Default redirect per role
  const defaultPath = nav[0].to;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 px-4 flex items-center h-12">
        {/* Brand */}
        <div className="flex items-center gap-2 mr-6">
          <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
            <ShoppingBag size={14} className="text-white" />
          </div>
          <span className="font-black text-gray-900 text-sm">Sales Order</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-1 flex-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                  isActive ? 'bg-violet-50 text-violet-700' : 'text-gray-500 hover:bg-gray-50'
                }`
              }
            >
              <Icon size={14} /> {label}
            </NavLink>
          ))}
        </div>

        {/* User + logout */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-gray-800 leading-none">{user.name}</p>
            <p className="text-[10px] text-gray-400 capitalize mt-0.5">{user.role}</p>
          </div>
          <span className="text-xl">{user.avatar}</span>
          <button
            onClick={onLogout}
            title="Sign out"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </nav>

      {/* Pages */}
      <div className="flex-1">
        <Routes>
          <Route path="/"          element={user.role === 'admin'     ? <SalesDashboard />              : <Navigate to={defaultPath} replace />} />
          <Route path="/products"  element={user.role === 'admin'     ? <ProductsPage />                : <Navigate to={defaultPath} replace />} />
          <Route path="/warehouse" element={['admin','warehouse'].includes(user.role) ? <WarehouseDashboard /> : <Navigate to={defaultPath} replace />} />
          <Route path="/new-order" element={['admin','salesperson'].includes(user.role) ? <NewOrderPage user={user} /> : <Navigate to={defaultPath} replace />} />
          <Route path="/orders"    element={<OrdersPage user={user} />} />
          <Route path="*"          element={<Navigate to={defaultPath} replace />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => authStore.getUser());

  const handleLogin  = (u) => setUser(u);
  const handleLogout = () => { authStore.logout(); setUser(null); };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  return <AppShell user={user} onLogout={handleLogout} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      {import.meta.env.DEV && <Agentation />}
      <Toaster position="top-right" toastOptions={{
        style: { fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 500 },
        success: { iconTheme: { primary: '#7c3aed', secondary: '#fff' } },
      }} />
    </QueryClientProvider>
  </React.StrictMode>
);
