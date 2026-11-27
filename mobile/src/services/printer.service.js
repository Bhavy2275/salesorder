/**
 * printer.service.js — SHREYANS 58mm Bluetooth receipt printing.
 *
 * The order is already confirmed before this service is called. A printer
 * failure must never undo or block that confirmation.
 */
import * as SecureStore from 'expo-secure-store';
import {
  CODEPAGE,
  EscPosBuilder,
  connectToPrinter,
  ensureBluetoothPermission,
  findPrinters,
  isBluetoothEnabled,
  printBytes,
} from '@ricka7x/expo-thermal-printer';
import { fetchOrderDetail } from '../api/orders.api';

const SAVED_PRINTER_KEY = 'ag_receipt_printer_address';
const RECEIPT_COLUMNS = 32; // 58mm paper
const BUSINESS = {
  name: 'MALANI AGRO FOODS PRODUCT PVT LIMTED',
  address: 'GHYASIPURA, NEAR MALANI DAL MILL, BAHRAICH, UTTAR PRADESH, 271801',
  gstin: '09AANCM7213P1ZR',
  iec: 'AANCM7213P',
  email: 'malaniagrofoods@gmail.com',
};

const money = (value) => `Rs ${Number(value || 0).toFixed(2)}`;

function fitLine(left, right, columns = RECEIPT_COLUMNS) {
  const tail = String(right ?? '');
  const head = String(left ?? '').slice(0, Math.max(1, columns - tail.length - 1));
  return `${head}${' '.repeat(Math.max(1, columns - head.length - tail.length))}${tail}`;
}

export function buildOrderReceipt(order) {
  // Small thermal printers tend to print thin strokes faintly. Keep the whole
  // receipt in bold mode so every detail remains readable on paper.
  const builder = new EscPosBuilder()
    .init()
    .codepage(CODEPAGE.CP850)
    .bold(true)
    // ESC/POS double-strike adds print-head emphasis on printers that support it.
    .raw(0x1b, 0x47, 0x01);
  const items = order.items || [];
  const address = order.delivery_address || order.client?.delivery_address || {};
  const addressText = [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean).join(', ');

  builder.align('center')
    .wrapped(BUSINESS.name, { columns: RECEIPT_COLUMNS })
    .size(1, 2).line('SALES ORDER').size(1, 1)
    .wrapped(BUSINESS.address, { columns: RECEIPT_COLUMNS })
    .line(`GSTIN: ${BUSINESS.gstin}`)
    .line(`IEC: ${BUSINESS.iec}`)
    .line(BUSINESS.email)
    .dashedRule().align('left');
  builder.line(`Order: ${order.order_number || order.id}`);
  builder.line(`Date: ${new Date(order.placed_at || order.created_at || Date.now()).toLocaleString('en-IN')}`);
  builder.line(`Client: ${order.client?.business_name || '—'}`);
  if (order.client?.mobile_primary) builder.line(`Mobile: ${order.client.mobile_primary}`);
  if (addressText) builder.wrapped(`Delivery: ${addressText}`, { columns: RECEIPT_COLUMNS });
  builder.dashedRule();

  for (const item of items) {
    builder.wrapped(item.product_name || item.name || 'Item', { columns: RECEIPT_COLUMNS });
    if (item.hsn_code || item.hsn) builder.line(`HSN Number: ${item.hsn_code || item.hsn}`);
    builder.line(fitLine(`${item.quantity} ${item.unit || ''} x ${money(item.unit_price)}`, money(item.line_total)));
    if (Number(item.free_qty) > 0) {
      builder.wrapped(`  Free: ${item.free_qty} ${item.unit || ''} (${item.scheme_name || 'scheme'})`, { columns: RECEIPT_COLUMNS });
    }
  }

  builder.dashedRule();
  builder.line(fitLine('Subtotal', money(order.subtotal)));
  builder.line(fitLine('GST', money(order.total_gst)));
  if (Number(order.discount_amount) > 0) builder.line(fitLine('Discount', `-${money(order.discount_amount)}`));
  builder.size(1, 2).line(fitLine('TOTAL', money(order.grand_total))).size(1, 1);
  builder.line(`Payment: ${order.payment_terms || '—'}`);
  builder.line(`Status: ${order.status || 'confirmed'}`);
  if (order.notes) builder.wrapped(`Note: ${order.notes}`, { columns: RECEIPT_COLUMNS });
  return builder.align('center').feed(2).line('Thank you').raw(0x1b, 0x47, 0x00).feedToTear().build();
}

export async function discoverReceiptPrinters() {
  const granted = await ensureBluetoothPermission();
  if (!granted) throw new Error('Bluetooth permission is required to connect to the receipt printer.');
  if (!isBluetoothEnabled()) throw new Error('Turn on Bluetooth, then try again.');
  return findPrinters({ scanTimeoutMs: 5000 });
}

export async function saveReceiptPrinter(printer) {
  if (!printer?.address) throw new Error('Select a valid Bluetooth printer.');
  await connectToPrinter(printer.address);
  await SecureStore.setItemAsync(SAVED_PRINTER_KEY, printer.address);
  await SecureStore.setItemAsync(`${SAVED_PRINTER_KEY}:name`, printer.name || 'Receipt printer');
  return printer;
}

export async function getSavedReceiptPrinterName() {
  return SecureStore.getItemAsync(`${SAVED_PRINTER_KEY}:name`);
}

export async function printConfirmedOrder(order) {
  const address = await SecureStore.getItemAsync(SAVED_PRINTER_KEY);
  if (!address) return { status: 'not_configured' };

  const granted = await ensureBluetoothPermission();
  if (!granted) throw new Error('Bluetooth permission is required to print.');
  if (!isBluetoothEnabled()) throw new Error('Turn on Bluetooth, then try printing again.');

  await connectToPrinter(address);
  // OTP verification returns only an order summary; fetch its saved line items.
  const completeOrder = order.items?.length ? order : await fetchOrderDetail(order.id);
  await printBytes(buildOrderReceipt(completeOrder));
  return { status: 'printed' };
}
