import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { createWebSentinelLogger } from './middleware/webSentinelLogger.js';
import { authRouter } from './routes/auth.routes.js';
import { attendanceRouter } from './routes/attendance.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { coursesRouter } from './routes/courses.routes.js';
import { sendError } from './utils/response.js';

export const app = express();

// Core Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Attach WebSentinel Automated Non-Blocking Log Shipping Middleware
app.use(
  createWebSentinelLogger({
    webSentinelUrl: env.WEBSENTINEL_INGESTION_URL,
    apiKey: env.WEBSENTINEL_API_KEY,
    sourceApp: 'attendance-portal',
    batchSize: 5,
    flushIntervalMs: 1500,
    silent: env.NODE_ENV === 'test',
  })
);

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'attendance-portal-api',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Primary Business Routes
app.use('/api/auth', authRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/admin', adminRouter);
app.use('/api/courses', coursesRouter);

// 404 Route Handler (Interception point for scanner reconnaissance)
app.use((req: Request, res: Response) => {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`);
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.status || 500;
  sendError(
    res,
    statusCode,
    'INTERNAL_SERVER_ERROR',
    err.message || 'An unexpected server error occurred'
  );
});
