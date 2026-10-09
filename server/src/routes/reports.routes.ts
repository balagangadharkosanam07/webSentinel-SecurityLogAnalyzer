import { Router } from 'express';
import { getReportSummaryHandler, exportReportCsvHandler } from '../controllers/reports.controller.js';

const router = Router();

router.get('/summary', getReportSummaryHandler);
router.get('/export', exportReportCsvHandler);

export default router;
