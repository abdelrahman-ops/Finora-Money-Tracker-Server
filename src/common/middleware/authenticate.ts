import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { User } from '../../modules/users/model';

export interface AuthPayload {
  userId: string;
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * JWT authentication middleware.
 * Extracts the token from the Authorization header and attaches user info to req.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = header.split(' ')[1];
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }

  User.findById(payload.userId)
    .select('tokenVersion')
    .lean()
    .then((user) => {
      if (!user || user.tokenVersion !== payload.tokenVersion) {
        return next(new AppError('Session expired. Please sign in again.', 401));
      }
      req.user = { userId: payload.userId, tokenVersion: payload.tokenVersion };
      return next();
    })
    .catch(next);
}
