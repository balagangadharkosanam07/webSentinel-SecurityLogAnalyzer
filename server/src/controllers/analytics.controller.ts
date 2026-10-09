import { Request, Response } from 'express';
import { analyticsRepository } from '../repositories/analytics.repository.js';
import { sendSuccess } from '../utils/apiResponse.js';

export async function getOverviewHandler(_req: Request, res: Response): Promise<Response> {
  const metrics = await analyticsRepository.getOverviewMetrics();
  return sendSuccess(res, metrics);
}

export async function getRiskAnalyticsHandler(_req: Request, res: Response): Promise<Response> {
  const analytics = await analyticsRepository.getRiskAnalytics();
  return sendSuccess(res, analytics);
}
