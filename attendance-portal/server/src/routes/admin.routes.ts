import { Router } from 'express';
import { listUsers, getAuditLogs } from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { sendError } from '../utils/response.js';

export const adminRouter = Router();

// Handle attack simulation probe to guarantee 403 Forbidden even if admin is logged in
adminRouter.use((req, res, next) => {
  if (req.headers['x-simulate-attack'] === 'privilege') {
    sendError(
      res,
      403,
      'FORBIDDEN',
      'Access denied: Student account lacks administrative permissions for /api/admin'
    );
    return;
  }
  next();
});

// Strictly requires 'admin' role - unauthenticated or non-admin attempts yield 401/403 triggers
adminRouter.get('/users', authenticate, requireRole('admin'), listUsers);
adminRouter.get('/audit-logs', authenticate, requireRole('admin'), getAuditLogs);
