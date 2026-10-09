import { Request, Response } from 'express';
import { analyticsRepository } from '../repositories/analytics.repository.js';
import { sendSuccess } from '../utils/apiResponse.js';

export async function getReportSummaryHandler(req: Request, res: Response): Promise<Response> {
  const periodParam = (req.query.period as string) || '24h';
  const period = ['24h', '7d', '30d', 'all'].includes(periodParam)
    ? (periodParam as '24h' | '7d' | '30d' | 'all')
    : '24h';

  const report = await analyticsRepository.getReportSummary(period);
  return sendSuccess(res, report);
}

export async function exportReportCsvHandler(req: Request, res: Response): Promise<void> {
  const periodParam = (req.query.period as string) || '24h';
  const limit = req.query.limit ? Number(req.query.limit) : 2000;

  const logs = await analyticsRepository.getExportLogs(limit);

  const headers = [
    'Event_ID',
    'Timestamp_UTC',
    'Event_Type',
    'Source_IP',
    'Method',
    'Endpoint',
    'Status_Code',
    'Actor_ID',
    'Actor_Role',
    'Suspicious',
    'Message',
  ];

  const escapeCsv = (str: string | null | undefined): string => {
    if (!str) return '""';
    return `"${String(str).replace(/"/g, '""')}"`;
  };

  const rows = logs.map((l) => [
    l.id,
    l.timestamp,
    l.eventType,
    l.sourceIp,
    l.method,
    escapeCsv(l.endpoint),
    l.statusCode,
    l.actorId || 'N/A',
    l.actorRole || 'N/A',
    l.isSuspicious ? 'TRUE' : 'FALSE',
    escapeCsv(l.message),
  ]);

  const csvBody = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const filename = `WebSentinel_Report_${periodParam}_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvBody);
}
