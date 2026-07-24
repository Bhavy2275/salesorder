/**
 * orderTemplate.js — HTML template for order summary PDF
 *
 * Renders a complete invoice-style PDF with:
 * - Anti Gravity branding header
 * - Client + salesperson info
 * - Line items table (with scheme/free qty)
 * - GST breakdown footer
 * - Payment terms + signature block
 * - Order timeline
 *
 * All styles are inline or in a <style> block — required for Puppeteer rendering.
 */

export function buildOrderPDF(order) {
  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n || 0);

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const now = new Date().toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const addr = order.client?.delivery_address;
  const addressStr = addr
    ? [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
    : '—';

  const itemRows = (order.items || []).map((item, i) => {
    const freeRow = item.free_qty > 0
      ? `<tr class="free-row">
           <td>${i + 1}a</td>
           <td colspan="4" style="color:#059669;font-style:italic;">
             🎁 Free items — ${item.scheme_name || 'Scheme'}: +${item.free_qty} ${item.unit}(s)
           </td>
           <td colspan="3" style="color:#059669;font-weight:700;">FREE</td>
         </tr>`
      : '';

    return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <div class="product-name">${item.product_name}</div>
          <div class="product-sku">${item.sku_code}</div>
        </td>
        <td class="center">${item.quantity}</td>
        <td class="center">${item.unit}</td>
        <td class="right">${fmt(item.unit_price)}</td>
        <td class="center">${item.gst_percent}%</td>
        <td class="right">${fmt(item.gst_amount)}</td>
        <td class="right">${item.discount_amount > 0 ? fmt(item.discount_amount) : '—'}</td>
        <td class="right bold">${fmt(item.line_total)}</td>
      </tr>
      ${freeRow}
    `;
  }).join('');

  const STATUS_LABELS = {
    draft: 'Draft', placed: 'Confirmed', picking: 'Picking',
    packed: 'Packed', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled',
  };

  const paymentTermsLabels = {
    cash: 'Cash on Delivery', net_7: 'Net 7 Days', net_15: 'Net 15 Days',
    net_30: 'Net 30 Days', net_45: 'Net 45 Days', net_60: 'Net 60 Days', credit: 'Open Credit',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order #${order.order_number} — Anti Gravity</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      color: #1F2937;
      background: #fff;
      line-height: 1.5;
    }

    /* ─── Page layout ─────────────────────────── */
    .page { padding: 40px 44px; max-width: 900px; margin: 0 auto; }

    /* ─── Header ──────────────────────────────── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 3px solid #7C3AED;
      margin-bottom: 28px;
    }
    .logo-block { display: flex; align-items: center; gap: 12px; }
    .logo-icon {
      width: 44px; height: 44px;
      background: #7C3AED; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 22px; font-weight: 900;
    }
    .logo-text { font-size: 24px; font-weight: 900; color: #111827; letter-spacing: -0.5px; }
    .logo-sub { font-size: 11px; color: #9CA3AF; font-weight: 500; }

    .order-badge {
      text-align: right;
    }
    .order-number {
      font-size: 22px; font-weight: 900; color: #7C3AED; letter-spacing: 0.5px;
    }
    .order-label { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px; }
    .status-pill {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px; font-weight: 700;
      background: #EDE9FE; color: #4C1D95;
    }
    .status-pill.delivered { background: #D1FAE5; color: #065F46; }
    .status-pill.cancelled { background: #FEE2E2; color: #991B1B; }
    .status-pill.dispatched { background: #DDD6FE; color: #4C1D95; }

    /* ─── Two-column info grid ─────────────────── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }
    .info-box {
      border: 1px solid #F3F4F6;
      border-radius: 12px;
      padding: 16px;
      background: #FAFAFA;
    }
    .info-box-title {
      font-size: 9px; font-weight: 700; color: #9CA3AF;
      text-transform: uppercase; letter-spacing: 1.2px;
      margin-bottom: 10px;
    }
    .info-row { margin-bottom: 4px; }
    .info-label { font-size: 10px; color: #9CA3AF; }
    .info-value { font-size: 13px; font-weight: 600; color: #111827; }
    .info-value.large { font-size: 15px; font-weight: 800; }

    /* ─── Items table ──────────────────────────── */
    .section-title {
      font-size: 10px; font-weight: 700; color: #9CA3AF;
      text-transform: uppercase; letter-spacing: 1.2px;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    thead th {
      background: #7C3AED;
      color: #fff;
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.8px;
      padding: 10px 12px;
      text-align: left;
    }
    thead th.center { text-align: center; }
    thead th.right  { text-align: right; }
    tbody tr { border-bottom: 1px solid #F9FAFB; }
    tbody tr:nth-child(even) { background: #F9FAFB; }
    tbody td { padding: 10px 12px; font-size: 12px; color: #374151; vertical-align: middle; }
    tbody td.center { text-align: center; }
    tbody td.right  { text-align: right; }
    tbody td.bold   { font-weight: 700; color: #111827; }
    .product-name   { font-weight: 600; color: #111827; }
    .product-sku    { font-size: 10px; color: #9CA3AF; margin-top: 2px; }
    .free-row td    { background: #ECFDF5 !important; font-size: 11px; }

    /* ─── Totals ───────────────────────────────── */
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 28px;
    }
    .totals-box {
      width: 320px;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      overflow: hidden;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 9px 16px;
      border-bottom: 1px solid #F3F4F6;
      font-size: 12px;
    }
    .totals-row:last-child { border-bottom: none; }
    .totals-row .t-label { color: #6B7280; }
    .totals-row .t-val   { font-weight: 600; color: #374151; }
    .totals-row.grand {
      background: #7C3AED;
    }
    .totals-row.grand .t-label { color: #DDD6FE; font-weight: 700; font-size: 13px; }
    .totals-row.grand .t-val   { color: #fff; font-weight: 900; font-size: 16px; }
    .totals-row.discount .t-val { color: #059669; font-weight: 700; }

    /* ─── Notes + payment ──────────────────────── */
    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }
    .note-box {
      border: 1px solid #F3F4F6;
      border-radius: 12px;
      padding: 14px 16px;
    }

    /* ─── Signature block ──────────────────────── */
    .signature-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 28px;
    }
    .sig-line {
      border-top: 1.5px solid #D1D5DB;
      margin-top: 48px;
      padding-top: 8px;
    }
    .sig-name { font-weight: 700; font-size: 12px; color: #374151; }
    .sig-label { font-size: 10px; color: #9CA3AF; }

    /* ─── Footer ───────────────────────────────── */
    .footer {
      border-top: 1px solid #F3F4F6;
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left { font-size: 10px; color: #9CA3AF; line-height: 1.7; }
    .footer-right { text-align: right; }
    .footer-generated { font-size: 9px; color: #D1D5DB; }
    .footer-brand { font-size: 11px; font-weight: 800; color: #7C3AED; }
  </style>
</head>
<body>
<div class="page">

  <!-- ── Header ── -->
  <div class="header">
    <div class="logo-block">
      <div class="logo-icon">AG</div>
      <div>
        <div class="logo-text">Anti Gravity</div>
        <div class="logo-sub">B2B Field Sales Platform</div>
      </div>
    </div>
    <div class="order-badge">
      <div class="order-label">Order Confirmation</div>
      <div class="order-number">#${order.order_number}</div>
      <div>
        <span class="status-pill ${order.status}">
          ${STATUS_LABELS[order.status] || order.status}
        </span>
      </div>
    </div>
  </div>

  <!-- ── Info grid: Client + Salesperson + Order + Delivery ── -->
  <div class="info-grid">
    <!-- Client -->
    <div class="info-box">
      <div class="info-box-title">📦 Bill To</div>
      <div class="info-row">
        <div class="info-value large">${order.client?.business_name || '—'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Contact</div>
        <div class="info-value">${order.client?.contact_person || '—'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Mobile</div>
        <div class="info-value">${order.client?.mobile_primary || '—'}</div>
      </div>
      <div class="info-row" style="margin-top:8px;">
        <div class="info-label">Delivery Address</div>
        <div class="info-value" style="font-size:12px;line-height:1.6;">${addressStr}</div>
      </div>
    </div>

    <!-- Order details -->
    <div class="info-box">
      <div class="info-box-title">📋 Order Details</div>
      <div class="info-row">
        <div class="info-label">Order Date</div>
        <div class="info-value">${fmtDate(order.placed_at || order.created_at)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Delivery Date</div>
        <div class="info-value">${fmtDate(order.delivery_date)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Payment Terms</div>
        <div class="info-value">${paymentTermsLabels[order.payment_terms] || order.payment_terms || '—'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Salesperson</div>
        <div class="info-value">${order.salesperson?.name || '—'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Employee Code</div>
        <div class="info-value">${order.salesperson?.employee_code || '—'}</div>
      </div>
      ${order.otp_verified_at ? `
      <div class="info-row">
        <div class="info-label">OTP Verified</div>
        <div class="info-value">${fmtDate(order.otp_verified_at)} ✓</div>
      </div>` : ''}
    </div>
  </div>

  <!-- ── Items table ── -->
  <div class="section-title">Order Items</div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Product</th>
        <th class="center" style="width:50px">Qty</th>
        <th class="center" style="width:50px">Unit</th>
        <th class="right" style="width:90px">Unit Price</th>
        <th class="center" style="width:50px">GST%</th>
        <th class="right" style="width:80px">GST Amt</th>
        <th class="right" style="width:80px">Discount</th>
        <th class="right" style="width:90px">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- ── Totals ── -->
  <div class="totals-wrap">
    <div class="totals-box">
      <div class="totals-row">
        <span class="t-label">Subtotal (ex-GST)</span>
        <span class="t-val">${fmt(order.subtotal)}</span>
      </div>
      <div class="totals-row">
        <span class="t-label">Total GST</span>
        <span class="t-val">${fmt(order.total_gst)}</span>
      </div>
      ${Number(order.discount_amount) > 0 ? `
      <div class="totals-row discount">
        <span class="t-label">Scheme Discount</span>
        <span class="t-val">−${fmt(order.discount_amount)}</span>
      </div>` : ''}
      <div class="totals-row grand">
        <span class="t-label">Grand Total</span>
        <span class="t-val">${fmt(order.grand_total)}</span>
      </div>
    </div>
  </div>

  <!-- ── Notes + payment terms ── -->
  <div class="bottom-grid">
    <div class="note-box">
      <div class="info-box-title">📝 Notes</div>
      <p style="font-size:12px;color:#6B7280;line-height:1.6;">
        ${order.notes || 'No special instructions.'}
      </p>
    </div>
    <div class="note-box">
      <div class="info-box-title">⚡ Terms & Conditions</div>
      <p style="font-size:11px;color:#6B7280;line-height:1.7;">
        • Goods once dispatched are non-returnable without prior approval.<br/>
        • Payment due as per agreed terms: <strong>${paymentTermsLabels[order.payment_terms] || '—'}</strong><br/>
        • Any discrepancy must be reported within 48 hours of delivery.<br/>
        • Subject to jurisdiction of Anti Gravity's registered office.
      </p>
    </div>
  </div>

  <!-- ── Signature block ── -->
  <div class="signature-block">
    <div>
      <div class="sig-line">
        <div class="sig-name">${order.client?.business_name || 'Client'}</div>
        <div class="sig-label">Client Authorised Signature & Stamp</div>
      </div>
    </div>
    <div>
      <div class="sig-line">
        <div class="sig-name">For Anti Gravity</div>
        <div class="sig-label">
          ${order.salesperson?.name || ''}${order.salesperson?.employee_code ? ` (${order.salesperson.employee_code})` : ''}
        </div>
        <div class="sig-label">Authorised Signatory</div>
      </div>
    </div>
  </div>

  <!-- ── Footer ── -->
  <div class="footer">
    <div class="footer-left">
      <strong>Anti Gravity</strong> — B2B Field Sales & Inventory Platform<br/>
      This is a computer-generated document. No signature required unless specified.<br/>
      Order Reference: <strong>#${order.order_number}</strong>
    </div>
    <div class="footer-right">
      <div class="footer-brand">Anti Gravity</div>
      <div class="footer-generated">Generated: ${now}</div>
    </div>
  </div>

</div>
</body>
</html>`;
}
