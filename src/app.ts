import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { env } from './common/config/env';
import { globalLimiter } from './common/middleware/rateLimiter';
import { errorHandler } from './common/middleware/errorHandler';
import { requestLogger } from './common/middleware/requestLogger';
import { registerRoutes } from './modules/index';

import { connectDatabase } from './common/config/database';

const app = express();

// Set trust proxy for Vercel/proxies so express-rate-limit works properly
app.set('trust proxy', 1);

// Connect to DB for serverless environments (like Vercel) where app.ts is the entry point
connectDatabase().catch(err => console.error('Initial DB connection error:', err));

// ─── Security ───
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(mongoSanitize());
app.use(globalLimiter);

// ─── Body Parsing ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging ───
app.use(requestLogger);

// ─── Health Check ───
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ─── API Routes ───
registerRoutes(app);

// ─── 404 ───
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Global Error Handler ───
app.use(errorHandler);

export default app;
