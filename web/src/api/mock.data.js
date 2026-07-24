/**
 * mock.data.js — Realistic demo data for Sales Order web admin
 * Used when VITE_USE_MOCK=true (no backend / DB needed)
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

// ─── KPIs ─────────────────────────────────────────────────────────────────────
export const MOCK_KPIS = {
  total_revenue:     2847650,
  prev_revenue:      2504300,
  total_orders:      318,
  prev_orders:       287,
  avg_order_value:   8956,
  clients_served:    142,
  new_clients:       23,
  items_sold:        4821,
};

// ─── Revenue Trend (30 days) ──────────────────────────────────────────────────
function buildRevenueTrend(days) {
  const rows = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    rows.push({
      date_day:      dateStr,
      gross_revenue: rand(55000, 180000),
      order_count:   rand(6, 22),
    });
  }
  return rows;
}

// ─── Order Status Mix ─────────────────────────────────────────────────────────
export const MOCK_ORDER_STATUS = [
  { status: 'delivered',  count: 189 },
  { status: 'dispatched', count: 42  },
  { status: 'placed',     count: 37  },
  { status: 'picking',    count: 28  },
  { status: 'packed',     count: 14  },
  { status: 'cancelled',  count: 8   },
];

// ─── Top Products ─────────────────────────────────────────────────────────────
export const MOCK_TOP_PRODUCTS = [
  { product_name: 'Cadbury Dairy Milk 50g',   sku_code: 'CDM-50',   total_revenue: 284760, total_qty: 3240, total_orders: 87 },
  { product_name: 'Parle-G Biscuit 800g',      sku_code: 'PLG-800',  total_revenue: 198430, total_qty: 2810, total_orders: 74 },
  { product_name: 'Maggi Noodles 12pk',         sku_code: 'MGI-12P',  total_revenue: 187920, total_qty: 1920, total_orders: 68 },
  { product_name: 'Amul Butter 500g',           sku_code: 'AML-B500', total_revenue: 156340, total_qty: 1340, total_orders: 59 },
  { product_name: 'Tata Salt 1kg',              sku_code: 'TTS-1KG',  total_revenue: 134210, total_qty: 3870, total_orders: 53 },
  { product_name: 'Surf Excel 1kg',             sku_code: 'SFX-1KG',  total_revenue: 128760, total_qty: 920,  total_orders: 48 },
  { product_name: 'Sunfeast Dark Fantasy',       sku_code: 'SDF-150',  total_revenue: 112340, total_qty: 2140, total_orders: 44 },
  { product_name: 'Colgate MaxFresh 200g',       sku_code: 'CLG-200',  total_revenue: 98710,  total_qty: 1620, total_orders: 39 },
];

// ─── Team Leaderboard ─────────────────────────────────────────────────────────
export const MOCK_TEAM = [
  { salesperson_id: '1', salesperson_name: 'Rahul Sharma',   gross_revenue: 748200, total_orders: 89, clients_visited: 34, conversion_rate: 91 },
  { salesperson_id: '2', salesperson_name: 'Priya Mehta',    gross_revenue: 621500, total_orders: 74, clients_visited: 29, conversion_rate: 86 },
  { salesperson_id: '3', salesperson_name: 'Arjun Singh',    gross_revenue: 534800, total_orders: 61, clients_visited: 26, conversion_rate: 79 },
  { salesperson_id: '4', salesperson_name: 'Sneha Patil',    gross_revenue: 489300, total_orders: 55, clients_visited: 23, conversion_rate: 74 },
  { salesperson_id: '5', salesperson_name: 'Vikram Nair',    gross_revenue: 347200, total_orders: 39, clients_visited: 18, conversion_rate: 68 },
  { salesperson_id: '6', salesperson_name: 'Ananya Reddy',   gross_revenue: 106650, total_orders: 18, clients_visited: 12, conversion_rate: 61 },
];

// ─── Warehouse Stats ──────────────────────────────────────────────────────────
export const MOCK_WAREHOUSE_STATS = {
  total_placed:      12,
  total_picking:     7,
  total_packed:      4,
  total_dispatched:  9,
  total_delivered:   28,
  revenue_today:     184320,
  avg_fulfil_mins:   47,
};

// ─── Warehouse Order Queue ────────────────────────────────────────────────────
const CLIENTS = [
  { name: 'Sharma General Store',  mobile: '9876543210' },
  { name: 'Patel Kirana & Co.',    mobile: '9823456789' },
  { name: 'Mehta Distributors',    mobile: '9712345678' },
  { name: 'Singh Wholesale Hub',   mobile: '9867891234' },
  { name: 'Reddy Mart',            mobile: '9945678901' },
  { name: 'Joshi Supermarket',     mobile: '9834567012' },
  { name: 'Kumar Fast Food Supp.', mobile: '9756789012' },
  { name: 'Nair Trading Co.',      mobile: '9678901234' },
];
const SALESPERSONS = [
  { name: 'Rahul Sharma',  code: 'RS-01' },
  { name: 'Priya Mehta',   code: 'PM-02' },
  { name: 'Arjun Singh',   code: 'AS-03' },
  { name: 'Sneha Patil',   code: 'SP-04' },
];
const STATUSES = ['placed', 'placed', 'picking', 'picking', 'packed', 'dispatched', 'picking', 'placed', 'packed', 'dispatched', 'placed', 'picking'];

function buildOrderDate(daysAgo, hoursAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
}

function buildDeliveryDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const PRODUCTS = [
  { id: 'p1', name: 'Cadbury Dairy Milk 50g', sku: 'CDM-50',   barcode: '8901058001234', price: 20,   unit: 'piece' },
  { id: 'p2', name: 'Parle-G Biscuit 800g',   sku: 'PLG-800',  barcode: '8901098765432', price: 40,   unit: 'packet' },
  { id: 'p3', name: 'Maggi Noodles 12pk',      sku: 'MGI-12P',  barcode: '8901234567890', price: 180,  unit: 'box' },
  { id: 'p4', name: 'Amul Butter 500g',        sku: 'AML-B500', barcode: '8902343210987', price: 260,  unit: 'pack' },
  { id: 'p5', name: 'Tata Salt 1kg',           sku: 'TTS-1KG',  barcode: '8901111222333', price: 28,   unit: 'kg' },
  { id: 'p6', name: 'Surf Excel 1kg',          sku: 'SFX-1KG',  barcode: '8901234098765', price: 195,  unit: 'pack' },
];

function buildItems(count = 3) {
  const shuffled = [...PRODUCTS].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((p) => {
    const qty = rand(2, 20);
    return {
      id:           `item-${p.id}-${rand(1000, 9999)}`,
      product_id:   p.id,
      product_name: p.name,
      sku_code:     p.sku,
      quantity:     qty,
      free_qty:     qty >= 12 ? 2 : 0,
      unit:         p.unit,
      unit_price:   p.price,
      subtotal:     qty * p.price,
      scheme_name:  qty >= 12 ? 'Buy 12 Get 2 Free' : null,
      product: {
        barcode: p.barcode,
        images:  [],
      },
    };
  });
}

let _orders = null;

function generateOrders() {
  if (_orders) return _orders;

  _orders = Array.from({ length: 12 }, (_, i) => {
    const client = CLIENTS[i % CLIENTS.length];
    const sp = SALESPERSONS[i % SALESPERSONS.length];
    const status = STATUSES[i];
    const items = buildItems(rand(2, 5));
    const grand_total = items.reduce((s, it) => s + it.subtotal, 0);
    const delivDays = rand(-1, 4);

    return {
      id:            `order-${String(i + 1).padStart(4, '0')}`,
      order_number:  1000 + i + 1,
      status,
      client_name:   client.name,
      client_mobile: client.mobile,
      salesperson_name: sp.name,
      salesperson_code: sp.code,
      item_count:    items.length,
      total_quantity: items.reduce((s, it) => s + it.quantity, 0),
      grand_total,
      delivery_date: buildDeliveryDate(delivDays),
      is_overdue:    delivDays < 0,
      days_until_delivery: delivDays,
      placed_at:     buildOrderDate(rand(0, 2), rand(0, 8)),
      picking_started_at: ['picking','packed','dispatched'].includes(status) ? buildOrderDate(0, rand(1,4)) : null,
      packed_at:     ['packed','dispatched'].includes(status) ? buildOrderDate(0, rand(0, 2)) : null,
      dispatched_at: status === 'dispatched' ? buildOrderDate(0, rand(0, 1)) : null,
      delivered_at:  null,
      payment_terms: ['credit_30', 'cod', 'credit_15', 'prepaid'][i % 4],
      notes:         i % 3 === 0 ? 'Deliver before 10 AM only.' : null,
      items,
      salesperson:   { name: sp.name },
      client: {
        business_name:   client.name,
        contact_person:  client.name.split(' ')[0] + ' Bhai',
        mobile_primary:  client.mobile,
        delivery_address: {
          line1:    `${rand(1, 200)}, Main Market Road`,
          line2:    '',
          city:     ['Mumbai', 'Pune', 'Delhi', 'Bengaluru', 'Chennai'][i % 5],
          state:    ['Maharashtra', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu'][i % 5],
          pincode:  String(400000 + rand(1, 999)),
          landmark: i % 2 === 0 ? 'Near Bus Stop' : null,
        },
      },
    };
  });

  return _orders;
}

// ─── Mock API exports ─────────────────────────────────────────────────────────
export const mockAnalyticsApi = {
  getKPIs: async (days) => {
    await delay();
    return MOCK_KPIS;
  },
  getRevenueTrend: async (days) => {
    await delay(500);
    return buildRevenueTrend(days);
  },
  getTeam: async () => {
    await delay(400);
    return MOCK_TEAM;
  },
  getTopProducts: async (days, sortBy) => {
    await delay(450);
    const products = [...MOCK_TOP_PRODUCTS];
    if (sortBy === 'quantity') products.sort((a, b) => b.total_qty - a.total_qty);
    else products.sort((a, b) => b.total_revenue - a.total_revenue);
    return products;
  },
  getOrderStatus: async () => {
    await delay(350);
    return MOCK_ORDER_STATUS;
  },
};

export const mockWarehouseApi = {
  getStats: async () => {
    await delay(300);
    return MOCK_WAREHOUSE_STATS;
  },

  getQueue: async ({ status, search, page = 1, limit = 25 } = {}) => {
    await delay(400);
    let orders = generateOrders();
    if (status && status !== 'all') orders = orders.filter((o) => o.status === status);
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(
        (o) =>
          String(o.order_number).includes(q) ||
          o.client_name.toLowerCase().includes(q) ||
          o.salesperson_name.toLowerCase().includes(q)
      );
    }
    const total = orders.length;
    const start = (page - 1) * limit;
    const paginated = orders.slice(start, start + limit);
    return {
      orders: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: start + limit < total,
      },
    };
  },

  getOrderDetail: async (orderId) => {
    await delay(300);
    const orders = generateOrders();
    return orders.find((o) => o.id === orderId) || orders[0];
  },

  transitionStatus: async (orderId, newStatus) => {
    await delay(500);
    const orders = generateOrders();
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      order.status = newStatus;
      const now = new Date().toISOString();
      if (newStatus === 'picking')    order.picking_started_at = now;
      if (newStatus === 'packed')     order.packed_at = now;
      if (newStatus === 'dispatched') order.dispatched_at = now;
      if (newStatus === 'delivered')  order.delivered_at = now;
    }
    return order;
  },
};
