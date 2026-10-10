import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';

export interface WebSentinelLoggerOptions {
  webSentinelUrl?: string;
  apiKey?: string;
  sourceApp?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  silent?: boolean;
}

export interface ExtractedUser {
  id?: string | null;
  role?: string | null;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'authorization',
  'cookie',
  'creditcard',
  'cardnumber',
  'cvv',
  'ssn',
]);

/**
 * Deep sanitization helper removing plain secrets and tokens from metadata objects
 */
export function sanitizeLogPayload(obj: any, depth = 0): any {
  if (depth > 5 || obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogPayload(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isSensitive = Array.from(SENSITIVE_KEYS).some((s) => lowerKey.includes(s));
      if (isSensitive) {
        cleaned[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        cleaned[key] = sanitizeLogPayload(value, depth + 1);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  return obj;
}

/**
 * Classifies HTTP requests into standard RFC-2026-WS security event types
 */
export function classifySecurityEvent(
  method: string,
  path: string,
  statusCode: number,
  bodyText: string
): { eventType: string; isSuspicious: boolean; message: string } {
  let lowerPath = '';
  try {
    lowerPath = decodeURIComponent(path).toLowerCase();
  } catch {
    lowerPath = path.toLowerCase();
  }
  const lowerBody = bodyText.toLowerCase();

  // 1. SQL Injection Indicators (in query string, path, or payload)
  if (
    lowerBody.includes("' or '1'='1") ||
    lowerBody.includes("' or 1=1") ||
    lowerBody.includes('union select') ||
    lowerBody.includes('information_schema') ||
    lowerPath.includes("' or '1'='1") ||
    lowerPath.includes("' or 1=1") ||
    lowerPath.includes("union select") ||
    lowerPath.includes("information_schema") ||
    lowerPath.includes("' or '")
  ) {
    return {
      eventType: 'sql_injection_attempt',
      isSuspicious: true,
      message: `SQL injection attack pattern intercepted on ${method} ${path}`,
    };
  }

  // 2. XSS Attack Indicators
  if (
    lowerBody.includes('<script>') ||
    lowerBody.includes('javascript:') ||
    lowerBody.includes('onerror=') ||
    lowerPath.includes('<script>') ||
    lowerPath.includes('javascript:') ||
    lowerPath.includes('onerror=')
  ) {
    return {
      eventType: 'xss_attempt',
      isSuspicious: true,
      message: `Cross-site scripting (XSS) probe intercepted on ${method} ${path}`,
    };
  }

  // 3. Probing / Scanner Reconnaissance
  if (
    statusCode === 404 &&
    (lowerPath.includes('.env') ||
      lowerPath.includes('wp-login') ||
      lowerPath.includes('wp-admin') ||
      lowerPath.includes('phpmyadmin') ||
      lowerPath.includes('.git') ||
      lowerPath.includes('actuator') ||
      lowerPath.includes('config.json') ||
      lowerPath.includes('admin.php'))
  ) {
    return {
      eventType: 'not_found_probe',
      isSuspicious: true,
      message: `Unmapped scanner/reconnaissance probe detected on route ${path}`,
    };
  }

  // 4. Attendance Operations & Tampering (Prioritized over generic 403/POST checks)
  if (lowerPath.includes('/attendance')) {
    if (
      lowerPath.includes('bulk') ||
      lowerPath.includes('tamper') ||
      lowerPath.includes('records') ||
      method === 'PATCH' ||
      method === 'PUT' ||
      method === 'DELETE'
    ) {
      return {
        eventType: 'attendance_modify',
        isSuspicious: true,
        message: `Suspicious attendance records modification or bulk tampering requested via ${method} ${path}`,
      };
    }
    if (method === 'POST') {
      return {
        eventType: 'attendance_mark',
        isSuspicious: false,
        message: `New attendance session records committed on ${path}`,
      };
    }
  }

  // 5. Unauthorized / Privilege Escalation Probes
  if (statusCode === 403 || (statusCode === 401 && lowerPath.includes('/admin'))) {
    return {
      eventType: 'permission_denied',
      isSuspicious: true,
      message: `Access denied: Role lacks authorized permissions for restricted resource ${path}`,
    };
  }

  // 6. Authentication Events
  if (lowerPath.includes('/auth/login') || lowerPath.includes('/session')) {
    if (statusCode === 200 || statusCode === 201) {
      return {
        eventType: 'login_success',
        isSuspicious: false,
        message: 'Successful user authentication transaction',
      };
    }
    if (statusCode === 401) {
      return {
        eventType: 'login_failed',
        isSuspicious: true,
        message: 'Failed login attempt: Invalid authentication credentials',
      };
    }
  }

  // Default General Request
  return {
    eventType: 'api_request',
    isSuspicious: statusCode >= 500,
    message: `HTTP transaction ${method} ${path} responded with status ${statusCode}`,
  };
}

let activeBuffer: any[] = [];
let activeFlush: (() => Promise<void>) | null = null;

export async function flushLoggedEvents(): Promise<void> {
  if (activeFlush) {
    await activeFlush();
  }
}

/**
 * Creates the production-ready WebSentinel log shipping middleware
 */
export function createWebSentinelLogger(options: WebSentinelLoggerOptions = {}) {
  const {
    webSentinelUrl = env.WEBSENTINEL_INGESTION_URL,
    apiKey = env.WEBSENTINEL_API_KEY,
    sourceApp = 'attendance-portal',
    batchSize = 5,
    flushIntervalMs = 1500,
    silent = false,
  } = options;

  let buffer: any[] = [];
  let flushTimer: NodeJS.Timeout | null = null;

  const flush = async () => {
    if (buffer.length === 0) return;
    const batchToSend = [...buffer];
    buffer = [];

    try {
      const res = await fetch(webSentinelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WebSentinel-Key': apiKey,
        },
        body: JSON.stringify({
          source: sourceApp,
          logs: batchToSend,
        }),
      });

      if (!res.ok && !silent) {
        console.warn(`[WebSentinelLogger] Log transmission returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      if (!silent) {
        console.warn(`[WebSentinelLogger] Failed to dispatch logs to WebSentinel: ${err.message}`);
      }
    }
  };

  activeBuffer = buffer;
  activeFlush = flush;

  // Schedule periodic background flush
  flushTimer = setInterval(flush, flushIntervalMs);
  flushTimer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestId =
      (req.headers['x-request-id'] as string) || `req-gen-${crypto.randomBytes(4).toString('hex')}`;

    // Capture response completion without altering downstream data
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      let clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        clientIp = '127.0.0.1';
      }

      const sanitizedBody = sanitizeLogPayload(req.body || {});
      const bodyString = typeof req.body === 'object' ? JSON.stringify(sanitizedBody) : String(req.body || '');

      const classification = classifySecurityEvent(
        req.method,
        req.originalUrl || req.url,
        res.statusCode,
        bodyString
      );

      const logRecord = {
        timestamp: new Date().toISOString(),
        event_type: classification.eventType,
        source_ip: clientIp,
        method: req.method,
        endpoint: req.originalUrl || req.url,
        status_code: res.statusCode,
        actor_id: req.user?.id || null,
        actor_role: req.user?.role || null,
        request_id: requestId,
        source_app: sourceApp,
        message: classification.message,
        duration_ms: durationMs,
        is_suspicious: classification.isSuspicious,
        metadata: {
          client_ip: clientIp,
          user_agent: req.headers['user-agent'] || 'unknown',
          query: req.query || {},
          is_suspicious: classification.isSuspicious,
        },
      };

      buffer.push(logRecord);

      if (buffer.length >= batchSize || classification.isSuspicious) {
        flush();
      }
    });

    next();
  };
}
