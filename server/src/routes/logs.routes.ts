import { Router } from 'express';
import {
  importLogsHandler,
  getBatchesHandler,
  getBatchByIdHandler,
  getLogsHandler,
  getLogByIdHandler,
  getLogMetadataHandler,
  seedAllDatasetsHandler,
} from '../controllers/ingestion.controller.js';
import { authenticateIngestion } from '../middleware/authenticateIngestion.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const ingestionRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 120,
  message: 'Ingestion rate limit exceeded: maximum 120 batch imports per minute.',
});

// Ingestion Pipeline & Seeding Routes
router.post('/import', ingestionRateLimiter, authenticateIngestion, importLogsHandler);
router.post('/seed-all', seedAllDatasetsHandler);
router.get('/batches', getBatchesHandler);
router.get('/batches/:id', getBatchByIdHandler);

// Query Log Events & Distinct Metadata
router.get('/metadata', getLogMetadataHandler);
router.get('/', getLogsHandler);
router.get('/:id', getLogByIdHandler);

export default router;
