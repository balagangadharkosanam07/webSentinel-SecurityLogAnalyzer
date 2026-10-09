import { Router } from 'express';
import { listUsers, getAuditLogs } from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const adminRouter = Router();

// Strictly requires 'admin' role - unauthenticated or non-admin attempts yield 401/403 triggers
adminRouter.get('/users', authenticate, requireRole('admin'), listUsers);
adminRouter.get('/audit-logs', authenticate, requireRole('admin'), getAuditLogs);
