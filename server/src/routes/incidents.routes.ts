import { Router } from 'express';
import {
  correlateIncidentsHandler,
  getIncidentsHandler,
  getIncidentByIdHandler,
  updateIncidentStatusHandler,
} from '../controllers/incidents.controller.js';

const router = Router();

router.post('/correlate', correlateIncidentsHandler);
router.get('/', getIncidentsHandler);
router.get('/:id', getIncidentByIdHandler);
router.patch('/:id/status', updateIncidentStatusHandler);

export default router;
