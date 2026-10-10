import { Request, Response } from 'express';
import { detectionEngine } from '../detection/engine.js';
import { correlationService } from '../services/correlation.service.js';
import { alertsRepository, AlertQueryFilters } from '../repositories/alerts.repository.js';
import { detectionRulesRepository } from '../repositories/detectionRules.repository.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

export async function runDetectionHandler(req: Request, res: Response): Promise<Response> {
  const limit = req.body?.limit ? Number(req.body.limit) : 500;
  const result = await detectionEngine.run({ limit });
  await correlationService.correlateAlerts().catch((err) => {
    logger.error('Correlation after detection failed:', err);
  });

  return sendSuccess(res, result, {
    eventsEvaluated: result.totalEventsEvaluated,
    candidatesFound: result.candidatesFound,
    newAlertsCreated: result.newAlertsCreated,
  });
}

export async function getAlertsHandler(req: Request, res: Response): Promise<Response> {
  const { severity, status, rule_id, source_ip, search, page, limit } = req.query;

  const pageNum = page ? Math.max(1, Number(page)) : 1;
  const pageSize = limit ? Math.min(100, Math.max(1, Number(limit))) : 20;
  const offset = (pageNum - 1) * pageSize;

  const filters: AlertQueryFilters = {
    severity: typeof severity === 'string' && severity !== 'all' ? severity : undefined,
    status: typeof status === 'string' && status !== 'all' ? status : undefined,
    ruleId: typeof rule_id === 'string' && rule_id !== 'all' ? rule_id : undefined,
    sourceIp: typeof source_ip === 'string' && source_ip !== 'all' ? source_ip : undefined,
    search: typeof search === 'string' && search.trim() ? search.trim() : undefined,
    limit: pageSize,
    offset,
  };

  const [alertsList, total] = await Promise.all([
    alertsRepository.findMany(filters),
    alertsRepository.count(filters),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return sendSuccess(res, alertsList, {
    total,
    page: pageNum,
    limit: pageSize,
    totalPages,
    count: alertsList.length,
  });
}

export async function getAlertByIdHandler(req: Request, res: Response): Promise<Response> {
  const id = String(req.params.id);
  const alert = await alertsRepository.findById(id);

  if (!alert) {
    return sendError(res, 404, 'ALERT_NOT_FOUND', `Security alert '${id}' not found`);
  }

  return sendSuccess(res, alert);
}

export async function updateAlertStatusHandler(req: Request, res: Response): Promise<Response> {
  const id = String(req.params.id);
  const { status } = req.body;

  if (!status || typeof status !== 'string') {
    return sendError(res, 422, 'VALIDATION_FAILED', 'Field "status" is required and must be a string');
  }

  const validStatuses = ['open', 'investigating', 'resolved', 'false_positive'];
  if (!validStatuses.includes(status)) {
    return sendError(
      res,
      422,
      'INVALID_STATUS',
      `Status must be one of: ${validStatuses.join(', ')}`
    );
  }

  const updated = await alertsRepository.updateStatus(id, status);
  if (!updated) {
    return sendError(res, 404, 'ALERT_NOT_FOUND', `Security alert '${id}' not found`);
  }

  return sendSuccess(res, updated, { message: `Alert status updated to '${status}'` });
}

export async function getRulesHandler(_req: Request, res: Response): Promise<Response> {
  const rules = await detectionRulesRepository.findAll();
  return sendSuccess(res, rules, { total: rules.length });
}
