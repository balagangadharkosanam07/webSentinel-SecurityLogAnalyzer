export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  teacherId: string;
  teacherName?: string;
  createdAt?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface AttendanceRecord {
  id: string;
  courseId: string;
  courseCode?: string;
  courseName?: string;
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  sessionDate: string;
  status: AttendanceStatus;
  markedBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLogEvent {
  id?: string;
  timestamp: string;
  eventType: string;
  sourceIp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  actorId?: string | null;
  actorRole?: string | null;
  message?: string;
}
