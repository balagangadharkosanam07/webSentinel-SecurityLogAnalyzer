import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { verifyJwt } from '../utils/jwt.js';
import { sendError } from '../utils/response.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Validates JWT bearer tokens and attaches user context to the request
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication token is required');
    return;
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyJwt<AuthUser>(token, env.JWT_SECRET);

  if (!payload || !payload.id || !payload.role) {
    sendError(res, 401, 'INVALID_TOKEN', 'Session token is invalid or has expired');
    return;
  }

  req.user = payload;
  next();
}

/**
 * Role-Based Access Control (RBAC) guard
 */
export function requireRole(...allowedRoles: Array<'student' | 'teacher' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        403,
        'FORBIDDEN',
        `Access denied: Role '${req.user.role}' is not authorized to access this resource`
      );
      return;
    }

    next();
  };
}
