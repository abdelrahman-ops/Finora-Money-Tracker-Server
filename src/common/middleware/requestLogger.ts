import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Request logging middleware — logs every incoming request.
 * Logs: method, URL, userId (if authenticated), and body (truncated).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Log request
  const userId = (req as any).user?.userId || 'anon';
  const body = req.body && Object.keys(req.body).length > 0
    ? JSON.stringify(req.body).slice(0, 200)
    : '-';

  logger.info(`→ ${req.method} ${req.originalUrl} [user:${userId}] body:${body}`);

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 400 ? 'warn' : 'info';
    logger[level](`← ${req.method} ${req.originalUrl} ${status} ${duration}ms`);
  });

  next();
}
