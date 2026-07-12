import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export interface AuthPayload {
  userId: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

/**
 * Custom JWT session authentication middleware.
 * Validates request cookies/headers and attaches user context to req.user.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    let token = '';

    // 1. Check Authorization Header (Bearer Token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // 2. Check Cookie
    else if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      token = cookies.session_token || '';
    }

    if (!token) {
      return next(new AppError('Authentication required', 401));
    }

    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; role?: string };
    
    if (!decoded || !decoded.userId) {
      return next(new AppError('Invalid authentication token', 401));
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role || 'user',
    };

    return next();
  } catch (err: any) {
    return next(new AppError('Session validation failed: ' + (err.message || 'unknown error'), 401));
  }
}

/**
 * Authorization middleware that requires the authenticated user to be an admin.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Administrator access required to use AI features', 403));
  }
  return next();
}
