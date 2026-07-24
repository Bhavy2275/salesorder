/**
 * logger.js — Winston Logger
 *
 * Structured JSON logging for production (Railway / Datadog / Logtail)
 * Pretty-printed for development terminal output
 */

import winston from 'winston';
import { env } from '../config/env.js';

const { combine, timestamp, json, errors, colorize, printf } = winston.format;

// ─── Development format: colourised + readable ───────────────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
  })
);

// ─── Production format: structured JSON for log aggregation ──────────────────
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
  ],
  // Don't crash the process on unhandled logger errors
  exitOnError: false,
});

// ─── HTTP Request Logger Stream (for Morgan) ─────────────────────────────────
// Morgan will pipe HTTP logs through Winston
export const httpLogStream = {
  write: (message) => logger.http(message.trim()),
};
