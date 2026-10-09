import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { portalAttendance, portalCourses, portalUsers } from '../db/schema.js';
import { sendSuccess, sendError } from '../utils/response.js';

const markSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  courseId: z.string().min(1, 'Course ID is required'),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Session date must be in YYYY-MM-DD format'),
  status: z.enum(['present', 'absent', 'late']),
});

const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      recordId: z.string().min(1),
      status: z.enum(['present', 'absent', 'late']),
      sessionDate: z.string().optional(),
    })
  ).min(1, 'At least one record update is required'),
});

export async function markAttendance(req: Request, res: Response): Promise<void> {
  const parseResult = markSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Invalid input');
    return;
  }

  const { studentId, courseId, sessionDate, status } = parseResult.data;
  const markedBy = req.user!.id;

  try {
    // Check if record exists for this student + course + sessionDate
    const existing = await db
      .select()
      .from(portalAttendance)
      .where(
        and(
          eq(portalAttendance.studentId, studentId),
          eq(portalAttendance.courseId, courseId),
          eq(portalAttendance.sessionDate, sessionDate)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(portalAttendance)
        .set({
          status,
          markedBy,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(portalAttendance.id, existing[0].id))
        .returning();

      sendSuccess(res, { record: updated[0], updated: true });
      return;
    }

    const newRecordId = crypto.randomUUID();
    const created = await db
      .insert(portalAttendance)
      .values({
        id: newRecordId,
        studentId,
        courseId,
        sessionDate,
        status,
        markedBy,
      })
      .returning();

    sendSuccess(res, { record: created[0], updated: false }, 201);
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Failed to mark attendance: ${err.message}`);
  }
}

export async function getMyAttendance(req: Request, res: Response): Promise<void> {
  const studentId = req.user!.id;

  try {
    const records = await db
      .select({
        id: portalAttendance.id,
        courseId: portalAttendance.courseId,
        courseCode: portalCourses.code,
        courseName: portalCourses.name,
        sessionDate: portalAttendance.sessionDate,
        status: portalAttendance.status,
        markedBy: portalAttendance.markedBy,
        createdAt: portalAttendance.createdAt,
      })
      .from(portalAttendance)
      .innerJoin(portalCourses, eq(portalAttendance.courseId, portalCourses.id))
      .where(eq(portalAttendance.studentId, studentId))
      .orderBy(desc(portalAttendance.sessionDate));

    sendSuccess(res, { records, total: records.length });
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Failed to fetch attendance history: ${err.message}`);
  }
}

export async function getCourseAttendance(req: Request, res: Response): Promise<void> {
  const courseId = String(req.params.courseId);

  try {
    const records = await db
      .select({
        id: portalAttendance.id,
        courseId: portalAttendance.courseId,
        studentId: portalAttendance.studentId,
        studentName: portalUsers.name,
        studentEmail: portalUsers.email,
        sessionDate: portalAttendance.sessionDate,
        status: portalAttendance.status,
        markedBy: portalAttendance.markedBy,
        createdAt: portalAttendance.createdAt,
        updatedAt: portalAttendance.updatedAt,
      })
      .from(portalAttendance)
      .innerJoin(portalUsers, eq(portalAttendance.studentId, portalUsers.id))
      .where(eq(portalAttendance.courseId, courseId))
      .orderBy(desc(portalAttendance.sessionDate));

    sendSuccess(res, { records, total: records.length });
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Failed to fetch course attendance: ${err.message}`);
  }
}

export async function bulkUpdateAttendance(req: Request, res: Response): Promise<void> {
  const parseResult = bulkUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Invalid input');
    return;
  }

  const { updates } = parseResult.data;
  const markedBy = req.user!.id;

  try {
    const modifiedRecords: any[] = [];
    for (const item of updates) {
      const updated = await db
        .update(portalAttendance)
        .set({
          status: item.status,
          ...(item.sessionDate ? { sessionDate: item.sessionDate } : {}),
          markedBy,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(portalAttendance.id, item.recordId))
        .returning();

      if (updated.length > 0) {
        modifiedRecords.push(updated[0]);
      }
    }

    sendSuccess(res, {
      modifiedCount: modifiedRecords.length,
      records: modifiedRecords,
    });
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Bulk attendance update failed: ${err.message}`);
  }
}
