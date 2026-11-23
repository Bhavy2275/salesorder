import { jsPDF } from 'jspdf';

const money = (amount) =>
  `INR ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(amount) || 0)}`;

const getTotals = (order) => {
  const subtotal = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0,
  );
  const gst = (order.items || []).reduce(
    (sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0) * (Number(item.gst) || 0)) / 100, 0,
  );
  return { subtotal, gst, total: Number(order.grand_total) || subtotal + gst };
};

const paymentLabel = (value) => ({
  cod: 'Cash on Delivery',
  credit_15: 'Credit 15 Days',
  credit_30: 'Credit 30 Days',
  prepaid: 'Prepaid',
}[value] || String(value || '—').replaceAll('_', ' '));

const wrapName = (value, maxCharacters = 35) => {
  const words = String(value || 'Item').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export function downloadReceiptPdf(order) {
  const items = order.items || [];
  const { subtotal, gst, total } = getTotals(order);
  const rows = items.map((item) => ({ item, nameLines: wrapName(item.name) }));
  const height = Math.max(120, 68 + rows.reduce((sum, row) => sum + row.nameLines.length * 4 + 8, 0) + 44);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, height] });
  const center = (text, y, size = 8, bold = false) => {
    pdf.setFont('courier', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.text(String(text), 29, y, { align: 'center', maxWidth: 52 });
  };
  const rule = (y) => {
    pdf.setDrawColor(100);
    pdf.setLineWidth(0.2);
    pdf.line(3, y, 55, y);
  };

  let y = 7;
  center('SALES RECEIPT', y, 9, true); y += 5;
  center(`Order #${order.order_number}`, y, 7); y += 4;
  center(new Date(order.placed_at || Date.now()).toLocaleString('en-IN'), y, 6); y += 5;
  rule(y); y += 5;

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7);
  pdf.text(`Client: ${order.client?.name || '—'}`, 3, y, { maxWidth: 52 }); y += 4;
  pdf.text(`Salesperson: ${order.salesperson?.name || '—'}`, 3, y, { maxWidth: 52 }); y += 5;
  rule(y); y += 5;

  for (const { item, nameLines } of rows) {
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(7);
    pdf.text(nameLines, 3, y, { maxWidth: 52, lineHeightFactor: 1.1 });
    y += nameLines.length * 3.4;
    pdf.setFont('courier', 'normal');
    pdf.text(`${item.quantity} ${item.unit || ''} x ${money(item.price)}`, 3, y);
    pdf.text(money(item.price * item.quantity), 55, y, { align: 'right' });
    y += 6;
  }

  rule(y); y += 5;
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7);
  pdf.text('Subtotal', 3, y); pdf.text(money(subtotal), 55, y, { align: 'right' }); y += 4;
  pdf.text('GST', 3, y); pdf.text(money(gst), 55, y, { align: 'right' }); y += 5;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8);
  pdf.text('TOTAL', 3, y); pdf.text(money(total), 55, y, { align: 'right' }); y += 6;
  rule(y); y += 5;
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7);
  pdf.text(`Payment: ${paymentLabel(order.payment_terms)}`, 3, y, { maxWidth: 52 }); y += 8;
  center('Thank you for your business!', y, 7, true);

  pdf.save(`receipt-${order.order_number}.pdf`);
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

export function printReceipt(order) {
  const printWindow = window.open('', '_blank', 'width=420,height=700');
  if (!printWindow) return false;

  const { subtotal, gst, total } = getTotals(order);
  const itemRows = (order.items || []).map((item) => `
    <section class="item">
      <div class="name">${escapeHtml(item.name)}</div>
      <div class="row"><span>${escapeHtml(item.quantity)} ${escapeHtml(item.unit || '')} × ${escapeHtml(money(item.price))}</span><span>${escapeHtml(money(item.price * item.quantity))}</span></div>
    </section>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt #${escapeHtml(order.order_number)}</title>
    <style>
      @page { size: 58mm auto; margin: 3mm 2mm; }
      * { box-sizing: border-box; }
      body { width: 54mm; margin: 0 auto; color: #111; font: 9px/1.35 "Courier New", monospace; }
      h1, h2, p { margin: 0; }
      .center { text-align: center; }
      h1 { font-size: 13px; margin: 2mm 0 1mm; }
      h2 { font-size: 10px; margin-bottom: 1mm; }
      .muted { font-size: 8px; }
      .rule { border-top: 1px dashed #333; margin: 2mm 0; }
      .item { margin: 2mm 0; }
      .name { font-weight: bold; overflow-wrap: anywhere; }
      .row { display: flex; justify-content: space-between; gap: 2mm; }
      .row span:last-child { white-space: nowrap; text-align: right; }
      .total { font-size: 11px; font-weight: bold; }
      .thanks { margin-top: 4mm; }
    </style></head><body>
      <header class="center"><h1>SALES RECEIPT</h1>
        <p>Order #${escapeHtml(order.order_number)}</p><p class="muted">${escapeHtml(new Date(order.placed_at || Date.now()).toLocaleString('en-IN'))}</p>
      </header>
      <div class="rule"></div>
      <p>Client: ${escapeHtml(order.client?.name || '—')}</p><p>Salesperson: ${escapeHtml(order.salesperson?.name || '—')}</p>
      <div class="rule"></div>${itemRows}<div class="rule"></div>
      <div class="row"><span>Subtotal</span><span>${escapeHtml(money(subtotal))}</span></div>
      <div class="row"><span>GST</span><span>${escapeHtml(money(gst))}</span></div>
      <div class="row total"><span>TOTAL</span><span>${escapeHtml(money(total))}</span></div>
      <div class="rule"></div><p>Payment: ${escapeHtml(paymentLabel(order.payment_terms))}</p>
      <p class="center thanks">Thank you for your business!</p>
      <script>window.addEventListener('load', () => { window.focus(); window.print(); });</script>
    </body></html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
