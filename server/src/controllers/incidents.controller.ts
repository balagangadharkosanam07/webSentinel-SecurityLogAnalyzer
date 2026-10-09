import { Request, Response } from 'express';
import { correlationService } from '../services/correlation.service.js';
import { incidentsRepository, IncidentQueryFilters } from '../repositories/incidents.repository.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export async function correlateIncidentsHandler(_req: Request, res: Response): Promise<Response> {
  const result = await correlationService.correlateAlerts();
  return sendSuccess(res, result, {
    alertsProcessed: result.totalAlertsProcessed,
    incidentsCreated: result.incidentsCreated,
    alertsLinked: result.alertsLinked,
  });
}

export async function getIncidentsHandler(req: Request, res: Response): Promise<Response> {
  const { severity, status, search, page, limit } = req.query;

  const pageNum = page ? Math.max(1, Number(page)) : 1;
  const pageSize = limit ? Math.min(100, Math.max(1, Number(limit))) : 20;
  const offset = (pageNum - 1) * pageSize;

  const filters: IncidentQueryFilters = {
    severity: typeof severity === 'string' && severity !== 'all' ? severity : undefined,
    status: typeof status === 'string' && status !== 'all' ? status : undefined,
    search: typeof search === 'string' && search.trim() ? search.trim() : undefined,
    limit: pageSize,
    offset,
  };

  const [incidentList, total] = await Promise.all([
    incidentsRepository.findMany(filters),
    incidentsRepository.count(filters),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return sendSuccess(res, incidentList, {
    total,
    page: pageNum,
    limit: pageSize,
    totalPages,
    count: incidentList.length,
  });
}

export async function getIncidentByIdHandler(req: Request, res: Response): Promise<Response> {
  const id = String(req.params.id);
  const incident = await incidentsRepository.findByIdWithDetails(id);

  if (!incident) {
    return sendError(res, 404, 'INCIDENT_NOT_FOUND', `Security incident '${id}' not found`);
  }

  return sendSuccess(res, incident);
}

export async function updateIncidentStatusHandler(req: Request, res: Response): Promise<Response> {
  const id = String(req.params.id);
  const { status } = req.body;

  if (!status || typeof status !== 'string') {
    return sendError(res, 422, 'VALIDATION_FAILED', 'Field "status" is required and must be a string');
  }

  const validStatuses = ['open', 'investigating', 'mitigated', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    return sendError(
      res,
      422,
      'INVALID_STATUS',
      `Status must be one of: ${validStatuses.join(', ')}`
    );
  }

  const updated = await incidentsRepository.updateStatus(id, status);
  if (!updated) {
    return sendError(res, 404, 'INCIDENT_NOT_FOUND', `Security incident '${id}' not found`);
  }

  return sendSuccess(res, updated, { message: `Incident status updated to '${status}'` });
}
