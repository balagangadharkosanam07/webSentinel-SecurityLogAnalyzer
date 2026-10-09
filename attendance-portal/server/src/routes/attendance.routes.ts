import { Router } from 'express';
import {
  markAttendance,
  getMyAttendance,
  getCourseAttendance,
  bulkUpdateAttendance,
} from '../controllers/attendance.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const attendanceRouter = Router();

// Student-accessible route to view their own attendance
attendanceRouter.get('/my', authenticate, getMyAttendance);

// Teacher/Admin routes to mark and view course rosters
attendanceRouter.post('/mark', authenticate, requireRole('teacher', 'admin'), markAttendance);
attendanceRouter.get('/course/:courseId', authenticate, requireRole('teacher', 'admin'), getCourseAttendance);

// Sensitive bulk update / modifications (monitored for tampering)
attendanceRouter.post('/bulk-update', authenticate, requireRole('teacher', 'admin'), bulkUpdateAttendance);
attendanceRouter.patch('/records', authenticate, requireRole('teacher', 'admin'), bulkUpdateAttendance);
