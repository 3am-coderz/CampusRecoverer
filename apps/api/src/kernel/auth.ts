import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { UnauthorizedError, ForbiddenError } from './errors.js';
import { Role } from './ports.js';

export interface AuthUser {
  id: string;
  sub: string;
  email: string;
  role: Role;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7).trim();
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = {
      id: decoded.sub || decoded.id,
      sub: decoded.sub || decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    next();
  } catch (_err) {
    next(new UnauthorizedError('Invalid or expired token', 'INVALID_TOKEN'));
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required', 'AUTH_REQUIRED'));
  }
  next();
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required', 'AUTH_REQUIRED'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions for this resource', 'FORBIDDEN_ROLE'));
    }
    next();
  };
}
