/**
 * appStore.js — localStorage-backed data store
 * Acts as the "database" for the demo. No backend needed.
 */

// ─── Seed Data ────────────────────────────────────────────────────────────────
const SEED_PRODUCTS = [
  { id: 'p1', name: 'Cadbury Dairy Milk 50g',  sku: 'CDM-050',  category: 'Confectionery', mrp: 20,  price: 18,  gst: 18, stock: 240, unit: 'piece',  image: '🍫' },
  { id: 'p2', name: 'Parle-G Biscuit 800g',    sku: 'PLG-800',  category: 'Biscuits',      mrp: 40,  price: 36,  gst: 5,  stock: 180, unit: 'packet', image: '🍪' },
  { id: 'p3', name: 'Maggi Noodles 12pk',       sku: 'MGI-12P',  category: 'Instant Food',  mrp: 180, price: 162, gst: 5,  stock: 95,  unit: 'box',    image: '🍜' },
  { id: 'p4', name: 'Amul Butter 500g',         sku: 'AML-B500', category: 'Dairy',         mrp: 260, price: 240, gst: 5,  stock: 60,  unit: 'pack',   image: '🧈' },
  { id: 'p5', name: 'Tata Salt 1kg',            sku: 'TTS-1KG',  category: 'Staples',       mrp: 28,  price: 25,  gst: 5,  stock: 320, unit: 'kg',     image: '🧂' },
  { id: 'p6', name: 'Surf Excel 1kg',           sku: 'SFX-1KG',  category: 'Household',     mrp: 195, price: 175, gst: 18, stock: 42,  unit: 'pack',   image: '🧼' },
];

const SEED_ORDERS = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const store = {
  // ── Products ────────────────────────────────────────────────────────────────
  getProducts() {
    return load('so_products', SEED_PRODUCTS);
  },

  addProduct(product) {
    const products = this.getProducts();
    const newProduct = {
      ...product,
      id:    `p${Date.now()}`,
      stock: Number(product.stock) || 0,
      mrp:   Number(product.mrp)   || 0,
      price: Number(product.price) || 0,
      gst:   Number(product.gst)   || 0,
      image: product.image || '📦',
    };
    products.unshift(newProduct);
    save('so_products', products);
    return newProduct;
  },

  updateProduct(id, changes) {
    const products = this.getProducts().map((p) =>
      p.id === id ? { ...p, ...changes } : p
    );
    save('so_products', products);
  },

  deleteProduct(id) {
    const products = this.getProducts().filter((p) => p.id !== id);
    save('so_products', products);
  },

  adjustStock(productId, delta) {
    const products = this.getProducts().map((p) =>
      p.id === productId ? { ...p, stock: Math.max(0, (p.stock || 0) + delta) } : p
    );
    save('so_products', products);
  },

  // ── Orders ──────────────────────────────────────────────────────────────────
  getOrders() {
    return load('so_orders', SEED_ORDERS);
  },

  placeOrder({ salesperson, client, items, notes, paymentTerms }) {
    const orders = this.getOrders();
    const orderNumber = 1000 + orders.length + 1;
    const grandTotal = items.reduce(
      (s, it) => s + it.price * it.quantity, 0
    );

    const order = {
      id:           `ord-${Date.now()}`,
      order_number: orderNumber,
      status:       'placed',
      salesperson,
      client,
      items,
      notes,
      payment_terms: paymentTerms,
      grand_total:   grandTotal,
      placed_at:     new Date().toISOString(),
      picking_started_at: null,
      packed_at:          null,
      dispatched_at:      null,
      delivered_at:       null,
    };

    // Deduct stock
    items.forEach((item) => this.adjustStock(item.productId, -item.quantity));

    orders.unshift(order);
    save('so_orders', orders);
    return order;
  },

  updateOrderStatus(orderId, newStatus) {
    const orders = this.getOrders().map((o) => {
      if (o.id !== orderId) return o;
      const now = new Date().toISOString();
      return {
        ...o,
        status: newStatus,
        picking_started_at: newStatus === 'picking'    ? now : o.picking_started_at,
        packed_at:          newStatus === 'packed'     ? now : o.packed_at,
        dispatched_at:      newStatus === 'dispatched' ? now : o.dispatched_at,
        delivered_at:       newStatus === 'delivered'  ? now : o.delivered_at,
      };
    });
    save('so_orders', orders);
    return orders.find((o) => o.id === orderId);
  },

  clearAll() {
    localStorage.removeItem('so_products');
    localStorage.removeItem('so_orders');
  },
};
