import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { sanitizeLogPayload, classifySecurityEvent } from '../src/middleware/webSentinelLogger.js';

describe('Attendance Portal Integration & Security Suite', () => {
  let studentToken = '';
  let teacherToken = '';
  let adminToken = '';

  beforeAll(async () => {
    // Acquire login tokens for seeded demo users
    const studentRes = await request(app).post('/api/auth/login').send({
      email: 'student@portal.edu',
      password: 'StudentPassword2026!',
    });
    studentToken = studentRes.body.data.token;

    const teacherRes = await request(app).post('/api/auth/login').send({
      email: 'teacher@portal.edu',
      password: 'TeacherPassword2026!',
    });
    teacherToken = teacherRes.body.data.token;

    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@portal.edu',
      password: 'AdminPassword2026!',
    });
    adminToken = adminRes.body.data.token;
  });

  describe('1. Health Check Endpoint', () => {
    it('should return 200 OK with health status metadata', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('attendance-portal-api');
    });
  });

  describe('2. Authentication & Credential Verification', () => {
    it('should authenticate valid credentials and issue a signed JWT', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'teacher@portal.edu',
        password: 'TeacherPassword2026!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('teacher');
    });

    it('should reject invalid credentials with 401 Unauthorized (login_failed)', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'teacher@portal.edu',
        password: 'IncorrectPasswordAttempt!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should verify authenticated user profile via /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('student@portal.edu');
      expect(res.body.data.user.role).toBe('student');
    });

    it('should reject unauthenticated requests to /api/auth/me with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('3. Role-Based Access Control (RBAC) Enforcement', () => {
    it('should allow admin to access protected user directory', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(3);
    });

    it('should block non-admin student with 403 Forbidden on /api/admin/users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should block non-admin student with 403 Forbidden on /api/admin/audit-logs', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. Attendance Tracking Operations', () => {
    it('should allow student to query their personal attendance history', async () => {
      const res = await request(app)
        .get('/api/attendance/my')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.records)).toBe(true);
    });

    it('should permit teacher to record attendance session entry', async () => {
      const res = await request(app)
        .post('/api/attendance/mark')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId: 'usr-student-001',
          courseId: 'crs-cs101-001',
          sessionDate: '2026-10-09',
          status: 'present',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.record.status).toBe('present');
    });

    it('should reject attendance marking attempts by unauthorized student with 403', async () => {
      const res = await request(app)
        .post('/api/attendance/mark')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studentId: 'usr-student-001',
          courseId: 'crs-cs101-001',
          sessionDate: '2026-10-09',
          status: 'present',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow teacher to query course roster attendance', async () => {
      const res = await request(app)
        .get('/api/attendance/course/crs-cs101-001')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.records)).toBe(true);
    });
  });

  describe('5. Courses and Query Hardening', () => {
    it('should safely handle search requests without SQL vulnerability', async () => {
      const res = await request(app)
        .get("/api/courses/search?q=' OR '1'='1")
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Parameterized query means literal string is searched safely
      expect(Array.isArray(res.body.data.courses)).toBe(true);
    });

    it('should respond 404 for unmapped reconnaissance probes', async () => {
      const res = await request(app).get('/.env');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('6. Security Log Sanitizer & RFC-2026-WS Classifier Unit Logic', () => {
    it('should deeply redact sensitive credentials from telemetry payload', () => {
      const rawPayload = {
        email: 'attacker@evil.com',
        password: 'SuperSecretPassword123!',
        token: 'eyJh.eyJzdWIi.signature',
        authorization: 'Bearer secret_token',
        nested: {
          refreshToken: 'refresh_secret_token',
          safeField: 'attendance_log',
        },
      };

      const sanitized = sanitizeLogPayload(rawPayload);

      expect(sanitized.email).toBe('attacker@evil.com');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.authorization).toBe('[REDACTED]');
      expect(sanitized.nested.refreshToken).toBe('[REDACTED]');
      expect(sanitized.nested.safeField).toBe('attendance_log');
    });

    it('should classify reconnaissance probes correctly', () => {
      const res = classifySecurityEvent('GET', '/api/v1/.env', 404, '');
      expect(res.eventType).toBe('not_found_probe');
      expect(res.isSuspicious).toBe(true);
    });

    it('should classify failed login correctly', () => {
      const res = classifySecurityEvent('POST', '/api/auth/login', 401, '{"email":"bad@edu"}');
      expect(res.eventType).toBe('login_failed');
      expect(res.isSuspicious).toBe(true);
    });

    it('should classify permission denied correctly', () => {
      const res = classifySecurityEvent('GET', '/api/admin/audit-logs', 403, '');
      expect(res.eventType).toBe('permission_denied');
      expect(res.isSuspicious).toBe(true);
    });

    it('should classify SQL injection patterns correctly', () => {
      const res = classifySecurityEvent('GET', "/api/courses/search?q=' or '1'='1", 200, '');
      expect(res.eventType).toBe('sql_injection_attempt');
      expect(res.isSuspicious).toBe(true);
    });
  });
});
