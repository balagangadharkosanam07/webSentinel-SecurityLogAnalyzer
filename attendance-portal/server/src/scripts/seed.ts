import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db, pool, initPortalTables } from '../db/index.js';
import { portalUsers, portalCourses, portalAttendance } from '../db/schema.js';
import { hashPassword } from '../utils/password.js';

async function seed() {
  console.log('🌱 Initializing Attendance Portal database schema...');
  await initPortalTables();

  console.log('🌱 Seeding demo accounts and course rosters...');

  const defaultUsers = [
    {
      id: 'usr-admin-001',
      name: 'SOC Administrator',
      email: 'admin@portal.edu',
      password: 'AdminPassword2026!',
      role: 'admin' as const,
    },
    {
      id: 'usr-teacher-001',
      name: 'Prof. Alan Turing',
      email: 'teacher@portal.edu',
      password: 'TeacherPassword2026!',
      role: 'teacher' as const,
    },
    {
      id: 'usr-student-001',
      name: 'Alice Johnson',
      email: 'student@portal.edu',
      password: 'StudentPassword2026!',
      role: 'student' as const,
    },
    {
      id: 'usr-student-002',
      name: 'Bob Smith',
      email: 'bob@portal.edu',
      password: 'StudentPassword2026!',
      role: 'student' as const,
    },
    {
      id: 'usr-student-003',
      name: 'Charlie Davis',
      email: 'charlie@portal.edu',
      password: 'StudentPassword2026!',
      role: 'student' as const,
    },
  ];

  for (const u of defaultUsers) {
    const existing = await db
      .select()
      .from(portalUsers)
      .where(eq(portalUsers.email, u.email))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(portalUsers).values({
        id: u.id,
        name: u.name,
        email: u.email,
        passwordHash: hashPassword(u.password),
        role: u.role,
      });
      console.log(`   + Created user: ${u.email} (${u.role})`);
    } else {
      console.log(`   = User already exists: ${u.email}`);
    }
  }

  // Seed Courses
  const defaultCourses = [
    {
      id: 'crs-cs101-001',
      code: 'CS101',
      name: 'Introduction to Computer Security',
      teacherId: 'usr-teacher-001',
    },
    {
      id: 'crs-cs202-001',
      code: 'CS202',
      name: 'Relational Database Engineering',
      teacherId: 'usr-teacher-001',
    },
  ];

  for (const c of defaultCourses) {
    const existing = await db
      .select()
      .from(portalCourses)
      .where(eq(portalCourses.id, c.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(portalCourses).values(c);
      console.log(`   + Created course: ${c.code} - ${c.name}`);
    } else {
      console.log(`   = Course already exists: ${c.code}`);
    }
  }

  // Seed sample attendance records
  const sampleRecords = [
    {
      id: 'att-001',
      studentId: 'usr-student-001',
      courseId: 'crs-cs101-001',
      sessionDate: '2026-10-07',
      status: 'present',
      markedBy: 'usr-teacher-001',
    },
    {
      id: 'att-002',
      studentId: 'usr-student-002',
      courseId: 'crs-cs101-001',
      sessionDate: '2026-10-07',
      status: 'present',
      markedBy: 'usr-teacher-001',
    },
    {
      id: 'att-003',
      studentId: 'usr-student-003',
      courseId: 'crs-cs101-001',
      sessionDate: '2026-10-07',
      status: 'absent',
      markedBy: 'usr-teacher-001',
    },
    {
      id: 'att-004',
      studentId: 'usr-student-001',
      courseId: 'crs-cs101-001',
      sessionDate: '2026-10-08',
      status: 'present',
      markedBy: 'usr-teacher-001',
    },
    {
      id: 'att-005',
      studentId: 'usr-student-002',
      courseId: 'crs-cs101-001',
      sessionDate: '2026-10-08',
      status: 'late',
      markedBy: 'usr-teacher-001',
    },
  ];

  for (const r of sampleRecords) {
    const existing = await db
      .select()
      .from(portalAttendance)
      .where(eq(portalAttendance.id, r.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(portalAttendance).values(r);
      console.log(`   + Created attendance record: ${r.id} (${r.status})`);
    }
  }

  console.log('✅ Attendance Portal database seeding completed successfully!');
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
