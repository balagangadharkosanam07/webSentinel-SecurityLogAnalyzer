import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import {
  sanitizeLogPayload,
  classifySecurityEvent,
} from '../src/middleware/webSentinelLogger.js';

describe('Ingestion API Security & Logger Middleware (Phase 10)', () => {
  const app = createApp();

  const validSampleLog = {
    timestamp: new Date().toISOString(),
    event_type: 'login_failed',
    source_ip: '198.51.100.77',
    method: 'POST',
    endpoint: '/api/auth/login',
    status_code: 401,
    request_id: 'req-sec-test-01',
    source_app: 'attendance-portal',
    message: 'Authentication failed for user test',
  };

  it('POST /api/logs/import: should reject requests missing X-WebSentinel-Key with 401', async () => {
    const res = await request(app)
      .post('/api/logs/import')
      .send({
        source: 'external-streamer',
        logs: [validSampleLog],
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/logs/import: should reject requests with invalid X-WebSentinel-Key with 401', async () => {
    const res = await request(app)
      .post('/api/logs/import')
      .set('X-WebSentinel-Key', 'invalid-fake-key-123')
      .send({
        source: 'external-streamer',
        logs: [validSampleLog],
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_API_KEY');
  });

  it('POST /api/logs/import: should accept requests with valid X-WebSentinel-Key header with 201', async () => {
    const res = await request(app)
      .post('/api/logs/import')
      .set('X-WebSentinel-Key', env.INGESTION_API_KEY)
      .send({
        source: 'external-streamer',
        logs: [validSampleLog],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('batchId');
  });

  it('POST /api/logs/import: should reject oversized batches (>500 records) with 413 Payload Too Large', async () => {
    const oversizedBatch = Array.from({ length: 501 }, (_, i) => ({
      ...validSampleLog,
      request_id: `req-over-${i}`,
    }));

    const res = await request(app)
      .post('/api/logs/import')
      .set('X-WebSentinel-Key', env.INGESTION_API_KEY)
      .send({
        source: 'external-streamer',
        logs: oversizedBatch,
      });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('sanitizeLogPayload: should deeply redact sensitive credentials, tokens, and cards', () => {
    const rawPayload = {
      username: 'student101',
      password: 'SuperSecretPassword123!',
      nested: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsIn...',
        secretKey: 'top-secret',
        creditCard: '4111-2222-3333-4444',
        safeProperty: 'public_value',
      },
      tags: ['normal', { cookie: 'session_id_abc' }],
    };

    const sanitized = sanitizeLogPayload(rawPayload);

    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.nested.accessToken).toBe('[REDACTED]');
    expect(sanitized.nested.secretKey).toBe('[REDACTED]');
    expect(sanitized.nested.creditCard).toBe('[REDACTED]');
    expect(sanitized.nested.safeProperty).toBe('public_value');
    expect(sanitized.tags[1].cookie).toBe('[REDACTED]');
  });

  it('classifySecurityEvent: should accurately classify SQLi, XSS, 404 probes, and auth events', () => {
    // SQL Injection
    const sqli = classifySecurityEvent('POST', '/api/search', 500, "{ query: \"' OR '1'='1\" }");
    expect(sqli.eventType).toBe('sql_injection_attempt');
    expect(sqli.isSuspicious).toBe(true);

    // XSS probe
    const xss = classifySecurityEvent('POST', '/api/feedback', 200, "{ comment: \"<script>alert(1)</script>\" }");
    expect(xss.eventType).toBe('xss_attempt');
    expect(xss.isSuspicious).toBe(true);

    // Scanner 404 probe
    const probe = classifySecurityEvent('GET', '/.env', 404, '');
    expect(probe.eventType).toBe('not_found_probe');
    expect(probe.isSuspicious).toBe(true);

    // Login failed
    const failedLogin = classifySecurityEvent('POST', '/api/auth/login', 401, '');
    expect(failedLogin.eventType).toBe('login_failed');
    expect(failedLogin.isSuspicious).toBe(true);

    // Permission denied
    const forbidden = classifySecurityEvent('GET', '/api/admin/audit-logs', 403, '');
    expect(forbidden.eventType).toBe('permission_denied');
    expect(forbidden.isSuspicious).toBe(true);
  });
});
