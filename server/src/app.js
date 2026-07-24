/**
 * app.js — Express Application Setup
 *
 * Registers all middleware, routes, and error handlers.
 * Separated from index.js so it can be imported cleanly in tests.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { httpLogStream } from './utils/logger.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

// ── Route imports ─────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.routes.js';
// Future routes (uncomment as built):
import productRoutes from './routes/products.routes.js';
// import clientRoutes from './routes/clients.routes.js';
import orderRoutes from './routes/orders.routes.js';
import pdfRoutes from './routes/pdf.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import warehouseRoutes from './routes/warehouse.routes.js';

const app = express();

// ═══════════════════════════════════════════════
// SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════

// Helmet sets sensible security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow Cloudinary images
}));

// CORS — restrict to allowed origins
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed.`));
    }
  },
  credentials: true,            // Required for cookies (refresh token)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Token-Expires-In'],  // Allow client to read this header
}));

// ═══════════════════════════════════════════════
// REQUEST PARSING
// ═══════════════════════════════════════════════

app.use(express.json({ limit: '1mb' }));       // JSON body (reject large payloads)
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());                        // For reading refresh token cookie

// ═══════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════

// Morgan HTTP request logger — skips health checks to reduce log noise
app.use(morgan(
  env.NODE_ENV === 'production' ? 'combined' : 'dev',
  {
    stream: httpLogStream,
    skip: (req) => req.path === '/health',
  }
));

// ═══════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════

// Apply general rate limiter to all API routes
app.use('/api', apiLimiter);

// ═══════════════════════════════════════════════
// HEALTH CHECK
// Must be before auth middleware
// ═══════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Anti Gravity API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// ═══════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
// app.use('/api/clients', clientRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/orders/:id/pdf', pdfRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/warehouse', warehouseRoutes);

// ═══════════════════════════════════════════════
// ERROR HANDLERS (must be last)
// ═══════════════════════════════════════════════

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
