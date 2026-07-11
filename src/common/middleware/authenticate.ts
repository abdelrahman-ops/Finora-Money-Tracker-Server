import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/auth';
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

/**
 * Better Auth session authentication middleware.
 * Validates request cookies/headers and attaches user context to req.user.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  auth.api.getSession({ headers: req.headers })
    .then((sessionData) => {
      if (!sessionData) {
        return next(new AppError('Authentication required', 401));
      }
      req.user = { 
        userId: sessionData.user.id, 
        role: (sessionData.user as any).role || 'user' 
      };
      return next();
    })
    .catch((err) => {
      return next(new AppError('Session validation failed: ' + (err.message || 'unknown error'), 401));
    });
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

