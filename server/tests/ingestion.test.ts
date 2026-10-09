import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { randomUUID } from 'crypto';

describe('Log Ingestion Pipeline API (POST /api/logs/import)', () => {
  const app = createApp();

  const generateTestBatch = () => {
    const traceId = randomUUID().slice(0, 8);
    return [
      {
        timestamp: new Date().toISOString(),
        event_type: 'attendance_mark',
        actor_id: 'usr-tch-901',
        actor_role: 'teacher',
        source_ip: '10.0.12.44',
        method: 'POST',
        endpoint: '/api/attendance/classes/BIO101/sessions',
        status_code: 201,
        request_id: `req-ingest-${traceId}-1`,
        source_app: 'attendance-portal',
        message: 'Normal attendance marking session',
        duration_ms: 85,
        metadata: { class_id: 'BIO101', present: 28 },
      },
      {
        timestamp: new Date().toISOString(),
        event_type: 'login_failed',
        actor_id: null,
        actor_role: null,
        source_ip: '198.51.100.77',
        method: 'POST',
        endpoint: '/api/auth/login',
        status_code: 401,
        request_id: `req-ingest-${traceId}-2`,
        source_app: 'attendance-portal',
        message: 'Failed login password mismatch',
        duration_ms: 40,
        metadata: { attempted_user: 'prof@school.edu' },
      },
    ];
  };

  it('Stage 1-7: should accept a valid batch, normalize, persist, and record batch audit', async () => {
    const testBatch = generateTestBatch();

    const res = await request(app)
      .post('/api/logs/import')
      .send(testBatch);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('batchId');
    expect(res.body.data.acceptedCount).toBe(2);
    expect(res.body.data.rejectedCount).toBe(0);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.meta.batch_id).toBeDefined();
  });

  it('Pipeline Fault-Tolerance: should process partial batch accepting valid records while isolating malformed records', async () => {
    const traceId = randomUUID().slice(0, 8);
    const mixedBatch = [
      {
        timestamp: new Date().toISOString(),
        event_type: 'login_success',
        actor_id: 'usr-std-100',
        actor_role: 'student',
        source_ip: '10.0.5.2',
        method: 'POST',
        endpoint: '/api/auth/login',
        status_code: 200,
        request_id: `req-valid-${traceId}`,
        source_app: 'attendance-portal',
        message: 'Valid student login',
      },
      {
        // Malformed: missing timestamp, invalid event_type, invalid IP
        event_type: 'invalid_event_type_name',
        source_ip: 'not-an-ip-address',
        method: 'GET',
        endpoint: '/api/test',
        status_code: 200,
        request_id: `req-invalid-${traceId}`,
        source_app: 'attendance-portal',
        message: 'Malformed event',
      },
    ];

    const res = await request(app)
      .post('/api/logs/import')
      .send(mixedBatch);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.acceptedCount).toBe(1);
    expect(res.body.data.rejectedCount).toBe(1);
    expect(res.body.data.status).toBe('partial');
    expect(res.body.meta.rejected_items.length).toBe(1);
    expect(res.body.meta.rejected_items[0].index).toBe(1);
  });

  it('Deduplication Guarantee: re-sending the same batch must identify duplicates and not create duplicate rows', async () => {
    const testBatch = generateTestBatch();

    // 1st transmission
    const res1 = await request(app).post('/api/logs/import').send(testBatch);
    expect(res1.status).toBe(201);
    expect(res1.body.data.acceptedCount).toBe(2);

    // 2nd re-transmission (simulating network timeout retry)
    const res2 = await request(app).post('/api/logs/import').send(testBatch);
    expect(res2.status).toBe(201);
    expect(res2.body.data.acceptedCount).toBe(0);
    expect(res2.body.data.duplicateCount).toBe(2);
    expect(res2.body.data.status).toBe('partial');
  });

  it('Privacy Policy Invariant: records containing forbidden secrets (e.g. plain passwords) must be rejected', async () => {
    const traceId = randomUUID().slice(0, 8);
    const secretBatch = [
      {
        timestamp: new Date().toISOString(),
        event_type: 'login_failed',
        actor_id: null,
        actor_role: null,
        source_ip: '192.0.2.1',
        method: 'POST',
        endpoint: '/api/auth/login',
        status_code: 401,
        request_id: `req-leak-${traceId}`,
        source_app: 'attendance-portal',
        message: 'Authentication failed',
        metadata: {
          password: 'PlainSecretPassword123!', // Forbidden secret
        },
      },
    ];

    const res = await request(app).post('/api/logs/import').send(secretBatch);

    expect(res.status).toBe(201);
    expect(res.body.data.acceptedCount).toBe(0);
    expect(res.body.data.rejectedCount).toBe(1);
    expect(res.body.meta.rejected_items[0].errors[0]).toContain('Privacy Violation');
  });

  it('Batch Audit History: GET /api/logs/batches should return recorded ingestion batches', async () => {
    const res = await request(app).get('/api/logs/batches?limit=5');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('totalRecords');
    expect(res.body.data[0]).toHaveProperty('acceptedRecords');
  });

  it('Log Query API: GET /api/logs should return persisted logs with pagination', async () => {
    const res = await request(app).get('/api/logs?limit=5');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
