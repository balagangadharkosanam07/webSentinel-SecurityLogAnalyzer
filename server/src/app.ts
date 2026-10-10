import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';

export function createApp(): Express {
  const app = express();

  // 1. Security Headers via Helmet
  app.use(helmet());

  // 2. Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: env.CLIENT_URL === '*' ? true : env.CLIENT_URL,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-API-Key', 'X-WebSentinel-Key'],
      credentials: true,
    })
  );

  // 3. Body Parser with reasonable payload limit (prevents denial of service via large payloads)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Safe Request Logger & Request ID Correlation
  app.use(requestLogger);

  // 5. Mount API Routes
  app.use('/api', apiRouter);

  // 6. Handle Undefined Routes (404)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(`Endpoint '${req.method} ${req.originalUrl}' does not exist on this server`, 404, 'NOT_FOUND'));
  });

  // 7. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
