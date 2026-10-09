import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

export function getHealthStatus(_req: Request, res: Response): Response {
  const memory = process.memoryUsage();

  const healthData = {
    status: 'healthy',
    service: 'websentinel-api',
    version: '0.1.0-phase3',
    environment: env.NODE_ENV,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    system: {
      node_version: process.version,
      platform: process.platform,
      memory_rss_mb: Math.round(memory.rss / (1024 * 1024)),
      memory_heap_used_mb: Math.round(memory.heapUsed / (1024 * 1024)),
    },
  };

  return sendSuccess(res, healthData, {
    cached: false,
  });
}
