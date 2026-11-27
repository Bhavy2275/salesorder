import React, { useState } from 'react';
import { store } from '../../store/appStore';
import { Search, Plus, Minus, ShoppingCart, Trash2, CheckCircle, X, Download, Printer } from 'lucide-react';
import { downloadReceiptPdf, printReceipt } from '../../utils/receipt';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function SuccessModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center p-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h3 className="text-xl font-black text-gray-900 mb-1">Order Placed!</h3>
        <p className="text-gray-500 text-sm mb-4">
          Order <span className="font-bold text-gray-800">#{order.order_number}</span> has been submitted.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Items</span>
            <span className="font-semibold">{order.items.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="font-bold text-violet-700">{fmt(order.grand_total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Payment</span>
            <span className="font-semibold capitalize">{order.payment_terms.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={() => printReceipt(order)}
            className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition">
            <Printer size={16} /> Print Receipt
          </button>
          <button onClick={() => downloadReceiptPdf(order)}
            className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-3 rounded-xl transition">
            <Download size={16} /> Download PDF
          </button>
        </div>
        <button onClick={onClose}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition">
          Place Another Order
        </button>
      </div>
    </div>
  );
}

export default function NewOrderPage({ user }) {
  const [products]   = useState(() => store.getProducts());
  const [search, setSearch] = useState('');
  const [cart, setCart]     = useState({}); // { productId: quantity }
  const [client, setClient] = useState('');
  const [mobile, setMobile] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [notes, setNotes]   = useState('');
  const [payment, setPayment] = useState('cash');
  const [success, setSuccess] = useState(null);

  const filtered = products.filter(
    (p) =>
      p.stock > 0 &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
       p.sku.toLowerCase().includes(search.toLowerCase()) ||
       p.category.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart  = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeFromCart = (id) => setCart((c) => {
    const next = { ...c };
    if (next[id] > 1) next[id]--;
    else delete next[id];
    return next;
  });
  const removeAll = (id) => setCart((c) => { const n = { ...c }; delete n[id]; return n; });

  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const p = products.find((x) => x.id === id);
    return { ...p, quantity: qty, productId: id, total: p.price * qty };
  });
  const cartTotal = cartItems.reduce((s, it) => s + it.total, 0);
  const cartGST   = cartItems.reduce((s, it) => s + (it.total * it.gst) / 100, 0);

  const placeOrder = () => {
    if (!client.trim()) { alert('Please enter client name.'); return; }
    if (cartItems.length === 0) { alert('Add at least one product to cart.'); return; }
    const order = store.placeOrder({
      salesperson:  { name: user.name, id: user.id },
      client:       { name: client, mobile, alternate_mobile: alternateMobile, address, gstin },
      items:        cartItems.map((i) => ({ productId: i.id, name: i.name, sku: i.sku, hsn: i.hsn, price: i.price, quantity: i.quantity, unit: i.unit, gst: i.gst })),
      notes,
      paymentTerms: payment,
    });
    printReceipt(order);
    setSuccess(order);
    setCart({});
    setClient('');
    setMobile('');
    setAlternateMobile('');
    setAddress('');
    setGstin('');
    setNotes('');
  };

  if (success) {
    return <SuccessModal order={success} onClose={() => setSuccess(null)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Place New Order</h1>
          <p className="text-sm text-gray-400 mt-1">Hi {user.name} — select products and submit order</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Product Catalogue ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Client */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-3">Customer Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-gray-600">Party / Shop Name *<input value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Sharma General Store" className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-normal bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500" /></label>
                <label className="text-xs font-semibold text-gray-600">Mobile No.<input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Primary mobile" className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-normal bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500" /></label>
                <label className="text-xs font-semibold text-gray-600">Alternate Mobile (optional)<input type="tel" value={alternateMobile} onChange={(e) => setAlternateMobile(e.target.value)} placeholder="Alternate contact" className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-normal bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500" /></label>
                <label className="text-xs font-semibold text-gray-600">GST No. (optional)<input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="GSTIN" className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-normal bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500" /></label>
                <label className="sm:col-span-2 text-xs font-semibold text-gray-600">Address<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery / billing address" className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-normal bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500" /></label>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((p) => {
                const inCart = cart[p.id] || 0;
                return (
                  <div key={p.id}
                    className={`bg-white rounded-2xl border shadow-sm p-4 transition ${inCart > 0 ? 'border-violet-300 ring-1 ring-violet-200' : 'border-gray-100'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{p.image}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm leading-tight">{p.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.sku} · {p.category}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div>
                            <span className="font-black text-gray-900">{fmt(p.price)}</span>
                            <span className="text-xs text-gray-400 line-through ml-1">{fmt(p.mrp)}</span>
                          </div>
                          <span className="text-xs text-gray-400">{p.stock} left</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">+{p.gst}% GST</span>
                      {inCart === 0 ? (
                        <button onClick={() => addToCart(p.id)}
                          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition">
                          <Plus size={12} /> Add
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => removeFromCart(p.id)}
                            className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition">
                            <Minus size={13} />
                          </button>
                          <span className="w-6 text-center font-black text-gray-900 text-sm">{inCart}</span>
                          <button onClick={() => inCart < p.stock && addToCart(p.id)}
                            disabled={inCart >= p.stock}
                            className="w-7 h-7 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg flex items-center justify-center text-white transition">
                            <Plus size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-2 text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
                  No products found
                </div>
              )}
            </div>
          </div>

          {/* ── Cart ── */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm sticky top-20">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                <ShoppingCart size={16} className="text-violet-600" />
                <h2 className="font-bold text-gray-900">Order Cart</h2>
                <span className="ml-auto bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {cartItems.length} items
                </span>
              </div>

              {cartItems.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-400 text-sm">
                  <ShoppingCart size={28} className="mx-auto mb-2 opacity-30" />
                  No items added yet
                </div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {cartItems.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-xl">{it.image}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{it.name}</p>
                        <p className="text-xs text-gray-400">{it.quantity} × {fmt(it.price)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">{fmt(it.total)}</p>
                        <button onClick={() => removeAll(it.id)} className="text-gray-300 hover:text-red-400 transition">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-5 py-4 border-t border-gray-100 space-y-3">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(cartTotal)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>GST</span><span>{fmt(cartGST)}</span></div>
                  <div className="flex justify-between font-black text-gray-900 text-base pt-1 border-t border-gray-100">
                    <span>Total</span><span className="text-violet-700">{fmt(cartTotal + cartGST)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Payment Terms</label>
                  <select value={payment} onChange={(e) => setPayment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="cash">Cash</option>
                    <option value="online">Online</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes (optional)</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    rows={2} placeholder="Delivery instructions…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                </div>

                <button
                  onClick={placeOrder}
                  disabled={cartItems.length === 0 || !client.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> Confirm Order
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
