import dotenv from 'dotenv';
dotenv.config();

/**
 * Parse CORS_ORIGIN — supports single origin or comma-separated list.
 * Returns a string for single origin, string[] for multiple.
 */
function parseCorsOrigin(): string | string[] {
  const raw = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const origins = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/finora',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  MAX_REFRESH_SESSIONS: parseInt(process.env.MAX_REFRESH_SESSIONS || '5', 10),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || '20', 10),
  CORS_ORIGIN: parseCorsOrigin(),
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'no-reply@finora.app',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
} as const;
