import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const reqId = req.headers['x-request-id'] || 'unknown';

  // 1. Zod Schema Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    logger.warn(`Validation failure on ${req.method} ${req.originalUrl} [ReqID: ${reqId}]`, {
      errors: formattedErrors,
    });

    sendError(res, 422, 'VALIDATION_ERROR', 'Request validation failed', formattedErrors);
    return;
  }

  // 2. Body Parser / Malformed JSON Syntax Error
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    logger.warn(`Malformed JSON body on ${req.method} ${req.originalUrl} [ReqID: ${reqId}]`);
    sendError(res, 400, 'MALFORMED_JSON', 'Malformed JSON payload in request body');
    return;
  }

  // 3. Known Operational AppError
  if (err instanceof AppError) {
    logger.warn(`Operational error: ${err.message} [${err.code}] [ReqID: ${reqId}]`);
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // 4. Unexpected / Unhandled Server Error
  // CRITICAL SECURITY INVARIANT:
  // Log the complete error stack internally on the server, but NEVER leak it to the client!
  logger.error(`Unhandled internal error on ${req.method} ${req.originalUrl} [ReqID: ${reqId}]: ${err.message}`, {
    stack: err.stack,
  });

  sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    'An unexpected internal server error occurred. Please contact the SOC administrator.'
  );
}
