import { Router } from 'express';
import { listCourses, searchCourses, createCourse } from '../controllers/courses.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const coursesRouter = Router();

coursesRouter.get('/', listCourses);
coursesRouter.get('/search', searchCourses);
coursesRouter.post('/', authenticate, requireRole('teacher', 'admin'), createCourse);
