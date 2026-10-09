import { pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const portalUsers = pgTable('portal_users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  email: varchar('email', { length: 256 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 32 }).notNull(), // 'student' | 'teacher' | 'admin'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const portalCourses = pgTable('portal_courses', {
  id: varchar('id', { length: 36 }).primaryKey(),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  teacherId: varchar('teacher_id', { length: 36 }).references(() => portalUsers.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const portalAttendance = pgTable('portal_attendance', {
  id: varchar('id', { length: 36 }).primaryKey(),
  studentId: varchar('student_id', { length: 36 }).references(() => portalUsers.id).notNull(),
  courseId: varchar('course_id', { length: 36 }).references(() => portalCourses.id).notNull(),
  sessionDate: varchar('session_date', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(), // 'present' | 'absent' | 'late'
  markedBy: varchar('marked_by', { length: 36 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export type PortalUserModel = typeof portalUsers.$inferSelect;
export type NewPortalUser = typeof portalUsers.$inferInsert;

export type PortalCourseModel = typeof portalCourses.$inferSelect;
export type NewPortalCourse = typeof portalCourses.$inferInsert;

export type PortalAttendanceModel = typeof portalAttendance.$inferSelect;
export type NewPortalAttendance = typeof portalAttendance.$inferInsert;
