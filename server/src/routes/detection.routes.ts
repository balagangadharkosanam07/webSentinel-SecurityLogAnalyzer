import { Router } from 'express';
import { runDetectionHandler, getRulesHandler } from '../controllers/detection.controller.js';

const router = Router();

router.post('/run', runDetectionHandler);
router.get('/rules', getRulesHandler);

export default router;
