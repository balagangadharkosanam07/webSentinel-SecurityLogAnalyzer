import { Router } from 'express';
import healthRoutes from './health.routes.js';
import logsRoutes from './logs.routes.js';
import alertsRoutes from './alerts.routes.js';
import detectionRoutes from './detection.routes.js';
import incidentsRoutes from './incidents.routes.js';
import analyticsRoutes from './analytics.routes.js';
import reportsRoutes from './reports.routes.js';

const apiRouter = Router();

// Mount Active Endpoints
apiRouter.use('/health', healthRoutes);
apiRouter.use('/logs', logsRoutes);
apiRouter.use('/alerts', alertsRoutes);
apiRouter.use('/detection', detectionRoutes);
apiRouter.use('/incidents', incidentsRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/reports', reportsRoutes);

export default apiRouter;
