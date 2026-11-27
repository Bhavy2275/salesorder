import React, { useState, useCallback } from 'react';
import { store } from '../../store/appStore';
import {
  Plus, Pencil, Trash2, Package, Search, X, Check, AlertTriangle
} from 'lucide-react';

const CATEGORIES = ['Confectionery', 'Biscuits', 'Instant Food', 'Dairy', 'Staples', 'Household', 'Beverages', 'Personal Care', 'Other'];
const EMOJIS     = ['📦','🍫','🍪','🍜','🧈','🧂','🧼','🥤','🧴','🫙','🛒','🍱'];

function ProductForm({ initial = {}, onSave, onCancel }) {
  const [f, setF] = useState({
    name: '', sku: '', category: 'Staples', mrp: '', price: '', gst: '5', stock: '', unit: 'piece', image: '📦', hsn: '', logoUrl: '',
    ...initial,
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{initial.id ? 'Edit Product' : 'Add New Product'}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Emoji picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((em) => (
                <button key={em} type="button" onClick={() => setF((p) => ({ ...p, image: em }))}
                  className={`text-xl w-10 h-10 rounded-xl border-2 transition ${f.image === em ? 'border-violet-500 bg-violet-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Product Name *</label>
              <input value={f.name} onChange={set('name')} placeholder="e.g. Amul Butter 500g"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">HSN Code</label>
              <input value={f.hsn || ''} onChange={set('hsn')} placeholder="e.g. 1905" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Product Logo URL (optional)</label>
              <input value={f.logoUrl || ''} onChange={set('logoUrl')} placeholder="https://…" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">SKU Code *</label>
              <input value={f.sku} onChange={set('sku')} placeholder="e.g. AML-B500"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Category</label>
              <select value={f.category} onChange={set('category')}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">MRP (₹) *</label>
              <input type="number" value={f.mrp} onChange={set('mrp')} placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Selling Price (₹) *</label>
              <input type="number" value={f.price} onChange={set('price')} placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">GST %</label>
              <select value={f.gst} onChange={set('gst')}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50">
                {[0,5,12,18,28].map((g) => <option key={g} value={g}>{g}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Opening Stock *</label>
              <input type="number" value={f.stock} onChange={set('stock')} placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Unit</label>
              <select value={f.unit} onChange={set('unit')}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50">
                {['piece','packet','box','kg','litre','pack','dozen','carton'].map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button
            onClick={() => {
              if (!f.name || !f.sku || !f.mrp || !f.price || f.stock === '') return;
              onSave(f);
            }}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition flex items-center justify-center gap-2"
          >
            <Check size={15} /> {initial.id ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState(() => store.getProducts());
  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState(null); // null | 'add' | product-obj
  const [deleted, setDeleted]   = useState(null);

  const refresh = useCallback(() => setProducts(store.getProducts()), []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (data) => {
    if (data.id) store.updateProduct(data.id, data);
    else         store.addProduct(data);
    refresh();
    setModal(null);
  };

  const handleDelete = (id) => {
    store.deleteProduct(id);
    setDeleted(id);
    refresh();
    setTimeout(() => setDeleted(null), 2000);
  };

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-screen bg-gray-50">
      {modal && (
        <ProductForm
          initial={modal === 'add' ? {} : modal}
          onSave={handleSave}
          onCancel={() => setModal(null)}
        />
      )}

      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Product Inventory</h1>
            <p className="text-sm text-gray-400 mt-1">{products.length} products · Manage stock and pricing</p>
          </div>
          <button onClick={() => setModal('add')}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2.5 rounded-xl transition shadow-sm">
            <Plus size={16} /> Add Product
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total SKUs',    value: products.length,                                color: 'bg-violet-50 text-violet-700' },
            { label: 'Low Stock (<20)', value: products.filter((p) => p.stock < 20).length,  color: 'bg-amber-50 text-amber-700' },
            { label: 'Out of Stock',  value: products.filter((p) => p.stock === 0).length,   color: 'bg-red-50 text-red-700' },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl p-4 ${s.color} border border-white`}>
              <p className="text-3xl font-black">{s.value}</p>
              <p className="text-sm font-semibold mt-1 opacity-80">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or category…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">MRP</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">HSN</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">GST</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-16 text-gray-400">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No products found</p>
                </td></tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition ${deleted === p.id ? 'opacity-0' : ''}`}
                  style={{ transition: 'opacity 0.3s' }}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {p.logoUrl ? <img src={p.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain" /> : <span className="text-2xl">{p.image}</span>}
                      <span className="font-semibold text-gray-800">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3">
                    <span className="bg-violet-50 text-violet-700 text-xs font-semibold px-2.5 py-1 rounded-full">{p.category}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 line-through">{fmt(p.mrp)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(p.price)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">{p.hsn || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{p.gst}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-base ${p.stock === 0 ? 'text-red-600' : p.stock < 20 ? 'text-amber-600' : 'text-green-600'}`}>
                      {p.stock}
                    </span>
                    {p.stock < 20 && p.stock > 0 && <AlertTriangle size={11} className="inline ml-1 text-amber-500" />}
                    <span className="text-xs text-gray-400 ml-1">{p.unit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setModal(p)}
                        className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(p.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
