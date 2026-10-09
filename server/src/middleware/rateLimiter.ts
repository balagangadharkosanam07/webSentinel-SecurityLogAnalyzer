import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse.js';

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

/**
 * Lightweight sliding-window rate limiter middleware
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const clients = new Map<string, ClientRecord>();

  // Periodic cleanup every 5 minutes to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of clients.entries()) {
      if (now > record.resetTime) {
        clients.delete(ip);
      }
    }
  }, 300000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, bypass unless test explicitly tests rate limiting
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const record = clients.get(ip);

    if (!record || now > record.resetTime) {
      clients.set(ip, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      return next();
    }

    record.count++;

    if (record.count > options.maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      sendError(
        res,
        429,
        'RATE_LIMIT_EXCEEDED',
        options.message || `Rate limit exceeded. Maximum ${options.maxRequests} requests per ${options.windowMs / 1000}s allowed.`
      );
      return;
    }

    next();
  };
}
