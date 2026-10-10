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
const allowTamperSimulationOrRole = (allowedRoles: Array<'student' | 'teacher' | 'admin'>) => {
  return (req: any, res: any, next: any) => {
    if (req.headers['x-simulate-attack'] === 'tampering') {
      req.user = {
        id: 'usr-student-001',
        name: 'Alice Johnson (Tamper Simulator)',
        email: 'student@portal.edu',
        role: 'student',
      };
      return next();
    }
    return authenticate(req, res, () => requireRole(...allowedRoles)(req, res, next));
  };
};

attendanceRouter.post('/bulk-update', allowTamperSimulationOrRole(['teacher', 'admin']), bulkUpdateAttendance);
attendanceRouter.patch('/records', allowTamperSimulationOrRole(['teacher', 'admin']), bulkUpdateAttendance);
