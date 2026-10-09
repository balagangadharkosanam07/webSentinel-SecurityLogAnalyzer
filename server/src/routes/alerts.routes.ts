import { Router } from 'express';
import {
  getAlertsHandler,
  getAlertByIdHandler,
  updateAlertStatusHandler,
} from '../controllers/detection.controller.js';

const router = Router();

router.get('/', getAlertsHandler);
router.get('/:id', getAlertByIdHandler);
router.patch('/:id/status', updateAlertStatusHandler);

export default router;
