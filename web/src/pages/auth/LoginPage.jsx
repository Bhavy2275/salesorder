import React, { useState } from 'react';
import { authStore } from '../../store/authStore';
import { ShoppingBag, Eye, EyeOff } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);

  const handle = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500)); // simulate network
    const result = authStore.login(form.email, form.password);
    setLoading(false);
    if (result.success) onLogin(result.user);
    else setError(result.error);
  };

  const quickLogin = (email, password) => {
    setForm({ email, password });
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-200">
            <ShoppingBag size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Sales Order</h1>
          <p className="text-gray-500 text-sm mt-1">B2B Field Sales &amp; Inventory Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-100 border border-gray-100 p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Sign in to your account</h2>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
              <input
                name="email"
                value={form.email}
                onChange={handle}
                placeholder="e.g. admin"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={handle}
                  placeholder="Enter password"
                  required
                  className="w-full px-4 py-3 pr-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Demo Credentials — click to fill
            </p>
            <div className="space-y-2">
              {[
                { label: '👑 Admin',         email: 'admin',     pass: 'admin123',  desc: 'Manage products & view orders' },
                { label: '🧑‍💼 Salesperson',  email: 'rahul',     pass: 'sales123',  desc: 'Place orders as Rahul Sharma' },
                { label: '📦 Warehouse',     email: 'warehouse', pass: 'wh123',     desc: 'Update order fulfilment status' },
              ].map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => quickLogin(u.email, u.pass)}
                  className="w-full text-left flex items-start gap-3 bg-gray-50 hover:bg-violet-50 hover:border-violet-200 border border-gray-100 rounded-xl px-4 py-3 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-violet-700">{u.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{u.desc}</p>
                  </div>
                  <code className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-500 shrink-0 mt-0.5">
                    {u.email} / {u.pass}
                  </code>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
