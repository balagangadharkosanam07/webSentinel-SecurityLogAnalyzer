import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Router, Request, Response, NextFunction } from 'express';
import { createApp } from '../src/app.js';
import { validateRequest } from '../src/middleware/validateRequest.js';
import { z } from 'zod';
import { AppError, errorHandler } from '../src/middleware/errorHandler.js';

describe('Centralized Error Handler & Security Invariants', () => {
  // Test app for error handling middleware
  const errorTestApp = express();
  errorTestApp.use(express.json());

  const testRouter = Router();
  testRouter.get('/throw-unhandled', () => {
    throw new Error('Simulated database connection failure with internal credentials: user=postgres');
  });

  testRouter.get('/throw-operational', () => {
    throw new AppError('Resource already locked by another analyst', 409, 'RESOURCE_LOCKED');
  });

  testRouter.post(
    '/test-validation',
    validateRequest({
      body: z.object({
        source_ip: z.string().refine(
          (ip) =>
            /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
              ip
            ),
          { message: 'Must be valid IPv4 address' }
        ),
        event_count: z.number().int().positive(),
      }),
    }),
    (_req, res) => {
      res.json({ ok: true });
    }
  );

  errorTestApp.use('/test-errors', testRouter);

  // 404 handler
  errorTestApp.use((req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(`Endpoint '${req.method} ${req.originalUrl}' does not exist on this server`, 404, 'NOT_FOUND'));
  });

  // Central error handler
  errorTestApp.use(errorHandler);

  it('should return 404 for undefined routes with standard error envelope', async () => {
    const mainApp = createApp();
    const res = await request(mainApp).get('/api/route-that-does-not-exist-at-all');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.meta).toHaveProperty('timestamp');
  });

  it('SECURITY: should NEVER leak server stack traces or internal credentials to the client', async () => {
    const res = await request(errorTestApp).get('/test-errors/throw-unhandled');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    // Ensure generic safe message
    expect(res.body.error.message).toContain('unexpected internal server error occurred');
    // Critical: No stack trace exposed
    expect(res.body.stack).toBeUndefined();
    expect(res.body.error.stack).toBeUndefined();
    // Critical: Internal error message text containing "user=postgres" must not be sent to client
    expect(JSON.stringify(res.body)).not.toContain('user=postgres');
  });

  it('should handle operational AppErrors with appropriate status and code', async () => {
    const res = await request(errorTestApp).get('/test-errors/throw-operational');

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RESOURCE_LOCKED');
    expect(res.body.error.message).toBe('Resource already locked by another analyst');
  });

  it('should format Zod validation errors as 422 with field paths', async () => {
    const res = await request(errorTestApp)
      .post('/test-errors/test-validation')
      .send({
        source_ip: 'not-an-ip',
        event_count: -5,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });
});
