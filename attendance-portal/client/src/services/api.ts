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

function getApiBase(): string {
  const envBase = ((import.meta as any).env?.VITE_API_URL || '').trim();
  return envBase.replace(/\/$/, '');
}

export const API_BASE = getApiBase();

export const WEBSENTINEL_SOC_URL =
  (import.meta as any).env?.VITE_WEBSENTINEL_URL || 'http://localhost:3000';

async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(fullUrl, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Failed to connect to backend server at ${fullUrl}. Please check your connection or wait 30 seconds if the free server is waking up.`
    );
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    if (text.includes('<!doctype html>') || text.includes('<html')) {
      throw new Error(
        `Backend server at '${fullUrl}' returned HTML instead of JSON (Status ${response.status}). The service may still be waking up from sleep; please retry in 30 seconds.`
      );
    }
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Request failed with status ${response.status}`;
    const error: any = new Error(errorMsg);
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }

  if (!data) {
    throw new Error(`Invalid response received from server (${response.status})`);
  }

  return (data.data !== undefined ? data.data : data) as T;
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
        const rawRes = await fetch(`${API_BASE}/api/courses/search?q=' OR '1'='1 -- UNION SELECT NULL, NULL, NULL`);
        return {
          attack: 'SQL Injection Probe',
          status: rawRes.status,
          target: "/api/courses/search?q=' OR '1'='1",
          expectedRule: 'RULE-006: SQL Injection Attack Attempt',
        };
      }
      case 'scanner': {
        // Trigger reconnaissance probes across sensitive scanner targets
        const probePaths = ['/.env', '/wp-admin', '/.git', '/config.json'];
        const results: number[] = [];
        for (const p of probePaths) {
          try {
            const res = await fetch(`${API_BASE}${p}`);
            results.push(res.status);
          } catch {
            results.push(404);
          }
        }
        return {
          attack: 'Reconnaissance Scanner Probes',
          status: results[0] || 404,
          target: probePaths.join(', '),
          expectedRule: 'RULE-005: Unmapped Reconnaissance Scanning Probe',
        };
      }
      case 'bruteforce': {
        // Rapid 5 failed logins
        const results = [];
        for (let i = 1; i <= 5; i++) {
          const res = await fetch(`${API_BASE}/api/auth/login`, {
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
        // Request restricted admin endpoints with privilege simulation header to guarantee 403 Forbidden
        const endpoints = ['/api/admin/audit-logs', '/api/admin/users', '/api/admin/audit-logs'];
        const results: number[] = [];
        for (const ep of endpoints) {
          const res = await fetch(`${API_BASE}${ep}`, {
            headers: {
              'x-simulate-attack': 'privilege',
              Authorization: `Bearer ${authStorage.getToken() || 'unauthorized_probe_token'}`,
            },
          });
          results.push(res.status);
        }
        return {
          attack: 'Privilege Escalation Probes',
          status: results[0] || 403,
          target: '/api/admin/audit-logs',
          expectedRule: 'RULE-003: High Privilege Escalation Attempt',
        };
      }
      case 'tampering': {
        // Send 3 rapid tampering modifications to attendance records
        const results: number[] = [];
        for (let i = 1; i <= 3; i++) {
          const res = await fetch(`${API_BASE}/api/attendance/records`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-simulate-attack': 'tampering',
              Authorization: `Bearer ${authStorage.getToken() || ''}`,
            },
            body: JSON.stringify({
              updates: [
                { recordId: `att-00${i}`, status: 'present' },
              ],
            }),
          });
          results.push(res.status);
        }
        return {
          attack: 'Attendance Data Tampering Burst',
          status: results[0] || 200,
          target: '/api/attendance/records',
          expectedRule: 'RULE-004: Attendance Data Tampering Burst',
        };
      }
    }
  },
};
