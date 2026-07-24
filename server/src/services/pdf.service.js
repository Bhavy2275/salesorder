/**
 * pdf.service.js — Puppeteer PDF generation + Cloudinary upload
 *
 * Flow:
 *  1. buildOrderPDF(order) → HTML string
 *  2. renderPDF(html) → Buffer (via Puppeteer)
 *  3. uploadPDFToCloudinary(buffer, orderId) → secure Cloudinary URL
 *  4. Store URL in orders.pdf_url column
 *
 * Performance:
 *  - Browser instance is reused across requests (singleton with reconnect)
 *  - Lazy-launch: browser only starts on first PDF request
 *  - Timeout: 30s per render to prevent hang
 */

import puppeteer from 'puppeteer';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { buildOrderPDF } from './pdf/orderTemplate.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// ─── Cloudinary config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key:    env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// ─── Browser singleton ────────────────────────────────────────────────────────
let browserInstance = null;

async function getBrowser() {
  if (browserInstance) {
    try {
      // Test if browser is still alive
      await browserInstance.version();
      return browserInstance;
    } catch {
      logger.warn('Puppeteer browser crashed. Relaunching...');
      browserInstance = null;
    }
  }

  browserInstance = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',    // Critical for Docker/Linux
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',           // Required for some deployment envs
    ],
    timeout: 30000,
  });

  // Auto-cleanup on crash
  browserInstance.on('disconnected', () => {
    logger.warn('Puppeteer browser disconnected.');
    browserInstance = null;
  });

  logger.info('Puppeteer browser launched.');
  return browserInstance;
}

// ─── renderPDF ────────────────────────────────────────────────────────────────

/**
 * Render an HTML string to a PDF Buffer using Puppeteer.
 *
 * @param {string} html
 * @returns {Promise<Buffer>}
 */
async function renderPDF(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set viewport to A4-like width
    await page.setViewport({ width: 1000, height: 1414 });

    await page.setContent(html, {
      waitUntil: 'networkidle0',  // Wait for Google Fonts to load
      timeout: 20000,
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,      // Needed for coloured backgrounds and gradients
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false,
    });

    logger.info('PDF rendered successfully.');
    return Buffer.from(pdfBuffer);

  } finally {
    await page.close(); // Always close the page (not the browser)
  }
}

// ─── uploadPDFToCloudinary ────────────────────────────────────────────────────

/**
 * Upload a PDF buffer to Cloudinary.
 *
 * @param {Buffer} pdfBuffer
 * @param {string} orderId
 * @param {string} orderNumber
 * @returns {Promise<string>} Secure Cloudinary URL
 */
async function uploadPDFToCloudinary(pdfBuffer, orderId, orderNumber) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',              // PDFs are raw resources in Cloudinary
        folder: 'antigravity/orders',
        public_id: `order_${orderNumber}_${orderId}`,
        format: 'pdf',
        type: 'private',                   // Only accessible via signed URL
        tags: ['order', 'pdf', orderNumber],
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload error:', error);
          return reject(error);
        }
        logger.info(`PDF uploaded to Cloudinary: ${result.secure_url}`);
        resolve(result.secure_url);
      }
    );

    // Stream the buffer to Cloudinary
    const readable = Readable.from(pdfBuffer);
    readable.pipe(stream);
  });
}

// ─── generateSignedUrl ────────────────────────────────────────────────────────

/**
 * Generate a short-lived signed URL for a private Cloudinary PDF.
 * Required for private resource_type.
 *
 * @param {string} publicId - e.g., "antigravity/orders/order_ORD-001_uuid"
 * @returns {string} Signed download URL (valid for 24 hours)
 */
export function generateSignedDownloadUrl(publicId) {
  return cloudinary.utils.private_download_url(publicId, 'pdf', {
    expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    attachment: true, // Triggers download instead of in-browser view
  });
}

// ─── generateOrderPDF ────────────────────────────────────────────────────────

/**
 * Main entry point — generate order PDF, upload, and return URL.
 *
 * @param {object} order - Full order object with client, salesperson, items
 * @returns {Promise<{ pdfUrl: string, publicId: string }>}
 */
export async function generateOrderPDF(order) {
  // In development, skip real PDF generation if flag is set
  if (env.NODE_ENV !== 'production' && env.SKIP_PDF_IN_DEV === 'true') {
    logger.warn('[DEV] SKIP_PDF_IN_DEV=true — skipping Puppeteer render.');
    return { pdfUrl: `http://localhost:5000/api/orders/${order.id}/pdf-preview`, publicId: null };
  }

  logger.info(`Generating PDF for order ${order.order_number}...`);

  const html = buildOrderPDF(order);
  const pdfBuffer = await renderPDF(html);
  const pdfUrl = await uploadPDFToCloudinary(pdfBuffer, order.id, order.order_number);

  const publicId = `antigravity/orders/order_${order.order_number}_${order.id}`;
  return { pdfUrl, publicId };
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    logger.info('Puppeteer browser closed.');
  }
}
