import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ingestionService } from '../services/ingestion.service.js';
import { logEventsRepository, LogQueryFilter } from '../repositories/logEvents.repository.js';
import { detectionEngine } from '../detection/engine.js';
import { correlationService } from '../services/correlation.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

export async function importLogsHandler(req: Request, res: Response): Promise<Response> {
  let logs: unknown[];
  let source = 'attendance-portal';

  if (Array.isArray(req.body)) {
    logs = req.body;
  } else if (req.body && Array.isArray(req.body.logs)) {
    logs = req.body.logs;
    if (typeof req.body.source === 'string') {
      source = req.body.source;
    }
  } else {
    return sendError(
      res,
      422,
      'VALIDATION_FAILED',
      'Invalid log batch format: Expected an array of log records or an object containing a "logs" array'
    );
  }

  if (logs.length === 0) {
    return sendError(res, 422, 'VALIDATION_FAILED', 'Log batch must contain at least 1 record');
  }

  if (logs.length > 500) {
    return sendError(
      res,
      413,
      'PAYLOAD_TOO_LARGE',
      'Log batch exceeds maximum limit of 500 records per request'
    );
  }

  const result = await ingestionService.processBatch(logs, source);

  // Trigger background detection & correlation immediately for accepted telemetry
  if (result.acceptedCount > 0) {
    detectionEngine
      .run({ limit: 500 })
      .then(() => correlationService.correlateAlerts())
      .catch((err) => {
        logger.error('Background detection/correlation run failed:', err);
      });
  }

  return sendSuccess(
    res,
    result,
    {
      batch_id: result.batchId,
      accepted: result.acceptedCount,
      rejected: result.rejectedCount,
      duplicates: result.duplicateCount,
      rejected_items: result.rejectedItems,
    },
    201
  );
}

export async function getBatchesHandler(req: Request, res: Response): Promise<Response> {
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const batches = await ingestionService.getRecentBatches(limit);
  return sendSuccess(res, batches, { count: batches.length });
}

export async function getBatchByIdHandler(req: Request, res: Response): Promise<Response> {
  const id = String(req.params.id);
  const batch = await ingestionService.getBatchById(id);

  if (!batch) {
    return sendError(res, 404, 'BATCH_NOT_FOUND', `Ingestion batch '${id}' not found`);
  }

  return sendSuccess(res, batch);
}

export async function getLogsHandler(req: Request, res: Response): Promise<Response> {
  const {
    event_type,
    source_ip,
    status_code,
    only_suspicious,
    start_date,
    end_date,
    search,
    sort_by,
    sort_order,
    page,
    limit,
    offset,
  } = req.query;

  const pageNum = page ? Math.max(1, Number(page)) : 1;
  const pageSize = limit ? Math.min(200, Math.max(1, Number(limit))) : 20;
  const calculatedOffset = offset !== undefined ? Number(offset) : (pageNum - 1) * pageSize;

  const filters: LogQueryFilter = {
    search: typeof search === 'string' && search.trim() ? search.trim() : undefined,
    eventType: typeof event_type === 'string' && event_type !== 'all' ? event_type : undefined,
    sourceIp: typeof source_ip === 'string' && source_ip !== 'all' ? source_ip : undefined,
    statusCode: status_code && status_code !== 'all' ? Number(status_code) : undefined,
    onlySuspicious: only_suspicious === 'true',
    startDate: typeof start_date === 'string' && start_date ? start_date : undefined,
    endDate: typeof end_date === 'string' && end_date ? end_date : undefined,
    sortBy: (sort_by === 'statusCode' || sort_by === 'status_code') ? 'statusCode' : 'timestamp',
    sortOrder: sort_order === 'asc' ? 'asc' : 'desc',
    limit: pageSize,
    offset: calculatedOffset,
  };

  const [events, total] = await Promise.all([
    logEventsRepository.findMany(filters),
    logEventsRepository.count(filters),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return sendSuccess(res, events, {
    total,
    page: pageNum,
    limit: pageSize,
    totalPages,
    count: events.length,
    offset: calculatedOffset,
  });
}

export async function getLogByIdHandler(req: Request, res: Response): Promise<Response> {
  const id = String(req.params.id);
  const event = await logEventsRepository.findById(id);

  if (!event) {
    return sendError(res, 404, 'LOG_EVENT_NOT_FOUND', `Log event '${id}' not found`);
  }

  return sendSuccess(res, event);
}

export async function getLogMetadataHandler(_req: Request, res: Response): Promise<Response> {
  const [eventTypes, sourceIps, totalCount] = await Promise.all([
    logEventsRepository.getDistinctEventTypes(),
    logEventsRepository.getDistinctSourceIps(),
    logEventsRepository.count(),
  ]);

  return sendSuccess(res, {
    eventTypes,
    sourceIps,
    totalCount,
  });
}

export async function seedAllDatasetsHandler(_req: Request, res: Response): Promise<Response> {
  const sampleDir = path.resolve(process.cwd(), '../sample-logs');
  const datasetFiles = [
    { file: 'normal_traffic.json', source: 'dataset-normal' },
    { file: 'suspicious_credential_brute_force.json', source: 'dataset-brute-force' },
    { file: 'suspicious_unauthorized_access.json', source: 'dataset-unauthorized' },
    { file: 'suspicious_attendance_tampering.json', source: 'dataset-attendance-tampering' },
    { file: 'suspicious_recon_and_injection.json', source: 'dataset-recon-injection' },
  ];

  const results = [];

  for (const { file, source } of datasetFiles) {
    const filePath = path.join(sampleDir, file);
    if (!fs.existsSync(filePath)) {
      logger.warn(`Seed file '${file}' not found at path: ${filePath}`);
      continue;
    }

    try {
      const fileData = fs.readFileSync(filePath, 'utf-8');
      const records = JSON.parse(fileData);
      if (Array.isArray(records)) {
        const batchResult = await ingestionService.processBatch(records, source);
        results.push({
          file,
          source,
          total: batchResult.totalRecords,
          accepted: batchResult.acceptedCount,
          duplicates: batchResult.duplicateCount,
          rejected: batchResult.rejectedCount,
          status: batchResult.status,
          batchId: batchResult.batchId,
        });
      }
    } catch (err: any) {
      logger.error(`Failed to ingest seed file ${file}:`, err);
      results.push({
        file,
        source,
        error: err.message,
      });
    }
  }

  const grandTotal = await logEventsRepository.count();

  return sendSuccess(res, {
    message: 'All synthetic datasets processed into Neon PostgreSQL',
    totalLogsInDatabase: grandTotal,
    batches: results,
  });
}
