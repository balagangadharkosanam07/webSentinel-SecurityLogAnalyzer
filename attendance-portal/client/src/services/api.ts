import { User, Course, AttendanceRecord, AttendanceStatus, AuditLogEvent } from '../types/index.js';

const TOKEN_KEY = 'portal_token';
const USER_KEY = 'portal_user';

export const authStorage = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  getUser: (): User | null => {
    const raw = localStorage.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser: (user: User) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clearUser: () => localStorage.removeItem(USER_KEY),

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Request failed with status ${response.status}`;
    const error: any = new Error(errorMsg);
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }

  return data.data;
}

export const portalApi = {
  // Auth
  login: async (email: string, password: string): Promise<{ user: User; token: string }> => {
    const res = await apiFetch<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    authStorage.setToken(res.token);
    authStorage.setUser(res.user);
    return res;
  },

  register: async (name: string, email: string, password: string, role: string): Promise<{ user: User; token: string }> => {
    const res = await apiFetch<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
    authStorage.setToken(res.token);
    authStorage.setUser(res.user);
    return res;
  },

  getMe: async (): Promise<User> => {
    const res = await apiFetch<{ user: User }>('/api/auth/me');
    authStorage.setUser(res.user);
    return res.user;
  },

  // Student Attendance
  getMyAttendance: async (): Promise<AttendanceRecord[]> => {
    const res = await apiFetch<{ records: AttendanceRecord[] }>('/api/attendance/my');
    return res.records;
  },

  // Courses
  getCourses: async (): Promise<Course[]> => {
    const res = await apiFetch<{ courses: Course[] }>('/api/courses');
    return res.courses;
  },

  searchCourses: async (query: string): Promise<Course[]> => {
    const res = await apiFetch<{ courses: Course[] }>(`/api/courses/search?q=${encodeURIComponent(query)}`);
    return res.courses;
  },

  // Teacher / Admin Operations
  getCourseAttendance: async (courseId: string): Promise<AttendanceRecord[]> => {
    const res = await apiFetch<{ records: AttendanceRecord[] }>(`/api/attendance/course/${courseId}`);
    return res.records;
  },

  markAttendance: async (params: {
    studentId: string;
    courseId: string;
    sessionDate: string;
    status: AttendanceStatus;
  }): Promise<AttendanceRecord> => {
    const res = await apiFetch<{ record: AttendanceRecord }>('/api/attendance/mark', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.record;
  },

  bulkUpdateAttendance: async (
    updates: Array<{ recordId: string; status: AttendanceStatus; sessionDate?: string }>
  ): Promise<{ modifiedCount: number; records: AttendanceRecord[] }> => {
    return apiFetch('/api/attendance/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
  },

  // Admin Telemetry & Users
  getAdminUsers: async (): Promise<User[]> => {
    const res = await apiFetch<{ users: User[] }>('/api/admin/users');
    return res.users;
  },

  getAdminAuditLogs: async (): Promise<AuditLogEvent[]> => {
    const res = await apiFetch<{ events: AuditLogEvent[] }>('/api/admin/audit-logs');
    return res.events;
  },

  // Attack Simulators (Triggered to prove SOC ingestion & rule correlation live)
  simulateAttack: async (type: 'sqli' | 'scanner' | 'bruteforce' | 'privilege' | 'tampering') => {
    switch (type) {
      case 'sqli': {
        // Trigger SQLi probe on search
        const rawRes = await fetch("/api/courses/search?q=' OR '1'='1 -- UNION SELECT NULL, NULL, NULL");
        return {
          attack: 'SQL Injection Probe',
          status: rawRes.status,
          target: "/api/courses/search?q=' OR '1'='1",
          expectedRule: 'RULE-006: SQL Injection Attack Attempt',
        };
      }
      case 'scanner': {
        // Trigger reconnaissance on sensitive file paths
        const rawRes = await fetch('/.env');
        return {
          attack: 'Reconnaissance Probe',
          status: rawRes.status,
          target: '/.env',
          expectedRule: 'RULE-005: Unmapped Reconnaissance Scanning Probe',
        };
      }
      case 'bruteforce': {
        // Rapid 5 failed logins
        const results = [];
        for (let i = 1; i <= 5; i++) {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'victim@portal.edu',
              password: `InvalidPasswordAttempt_${i}`,
            }),
          });
          results.push(res.status);
        }
        return {
          attack: 'Brute Force / Credential Stuffing',
          attempts: 5,
          statuses: results,
          expectedRule: 'RULE-001 / RULE-002: Authentication Brute Force Burst',
        };
      }
      case 'privilege': {
        // Request restricted admin endpoints without admin authorization
        const res = await fetch('/api/admin/audit-logs', {
          headers: {
            Authorization: `Bearer ${authStorage.getToken() || 'invalid_token'}`,
          },
        });
        return {
          attack: 'Privilege Escalation Probe',
          status: res.status,
          target: '/api/admin/audit-logs',
          expectedRule: 'RULE-003: High Privilege Escalation Attempt',
        };
      }
      case 'tampering': {
        // Send bulk modify to attendance records
        const res = await fetch('/api/attendance/bulk-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authStorage.getToken() || ''}`,
          },
          body: JSON.stringify({
            updates: [
              { recordId: 'att-001', status: 'present' },
              { recordId: 'att-002', status: 'present' },
              { recordId: 'att-003', status: 'present' },
            ],
          }),
        });
        return {
          attack: 'Attendance Data Tampering Burst',
          status: res.status,
          target: '/api/attendance/bulk-update',
          expectedRule: 'RULE-004: Attendance Data Tampering Burst',
        };
      }
    }
  },
};
