import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { eq, ilike, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { portalCourses, portalUsers } from '../db/schema.js';
import { sendSuccess, sendError } from '../utils/response.js';

const createCourseSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(128),
  teacherId: z.string().optional(),
});

export async function listCourses(req: Request, res: Response): Promise<void> {
  try {
    const courses = await db
      .select({
        id: portalCourses.id,
        code: portalCourses.code,
        name: portalCourses.name,
        teacherId: portalCourses.teacherId,
        teacherName: portalUsers.name,
        createdAt: portalCourses.createdAt,
      })
      .from(portalCourses)
      .innerJoin(portalUsers, eq(portalCourses.teacherId, portalUsers.id));

    sendSuccess(res, { courses, total: courses.length });
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Failed to list courses: ${err.message}`);
  }
}

export async function searchCourses(req: Request, res: Response): Promise<void> {
  const query = (req.query.q as string) || '';

  try {
    if (!query.trim()) {
      return listCourses(req, res);
    }

    // Parameterized search against SQL injection
    const pattern = `%${query.trim()}%`;
    const courses = await db
      .select({
        id: portalCourses.id,
        code: portalCourses.code,
        name: portalCourses.name,
        teacherId: portalCourses.teacherId,
        teacherName: portalUsers.name,
        createdAt: portalCourses.createdAt,
      })
      .from(portalCourses)
      .innerJoin(portalUsers, eq(portalCourses.teacherId, portalUsers.id))
      .where(
        or(
          ilike(portalCourses.code, pattern),
          ilike(portalCourses.name, pattern)
        )
      );

    sendSuccess(res, { query, courses, total: courses.length });
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Search failed: ${err.message}`);
  }
}

export async function createCourse(req: Request, res: Response): Promise<void> {
  const parseResult = createCourseSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Invalid input');
    return;
  }

  const { code, name, teacherId } = parseResult.data;
  const assignedTeacherId = teacherId || req.user!.id;

  try {
    const courseId = crypto.randomUUID();
    const created = await db
      .insert(portalCourses)
      .values({
        id: courseId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        teacherId: assignedTeacherId,
      })
      .returning();

    sendSuccess(res, { course: created[0] }, 201);
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Failed to create course: ${err.message}`);
  }
}
