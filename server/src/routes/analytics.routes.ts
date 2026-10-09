import { Router } from 'express';
import { getOverviewHandler, getRiskAnalyticsHandler } from '../controllers/analytics.controller.js';

const router = Router();

router.get('/overview', getOverviewHandler);
router.get('/risk', getRiskAnalyticsHandler);

export default router;
