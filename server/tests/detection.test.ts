import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Detection Engine & Security Alerts API (Phase 7)', () => {
  const app = createApp();
  let sampleAlertId = '';

  it('GET /api/detection/rules: should list all 6 registered detection rules', async () => {
    const res = await request(app).get('/api/detection/rules');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(6);

    const ruleIds = res.body.data.map((r: any) => r.id);
    expect(ruleIds).toContain('RULE-001');
    expect(ruleIds).toContain('RULE-002');
    expect(ruleIds).toContain('RULE-003');
    expect(ruleIds).toContain('RULE-004');
    expect(ruleIds).toContain('RULE-005');
    expect(ruleIds).toContain('RULE-006');
  });

  it('POST /api/detection/run: should execute detection rules against Neon DB events and generate alerts', async () => {
    // First ensure attack scenarios are in DB
    await request(app).post('/api/logs/seed-all');

    const res = await request(app).post('/api/detection/run').send({ limit: 500 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalEventsEvaluated');
    expect(res.body.data).toHaveProperty('rulesExecuted');
    expect(res.body.data).toHaveProperty('candidatesFound');
    expect(res.body.data.candidatesFound).toBeGreaterThan(0);
  });

  it('GET /api/alerts: should return persisted alerts with pagination and filter support', async () => {
    const res = await request(app).get('/api/alerts?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.meta).toHaveProperty('page');

    sampleAlertId = res.body.data[0].id;
  });

  it('GET /api/alerts?severity=critical: should filter alerts by severity', async () => {
    const res = await request(app).get('/api/alerts?severity=critical');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const alert of res.body.data) {
      expect(alert.severity).toBe('critical');
    }
  });

  it('GET /api/alerts/:id: should return single alert with hydrated supporting log events', async () => {
    expect(sampleAlertId).toBeTruthy();

    const res = await request(app).get(`/api/alerts/${sampleAlertId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(sampleAlertId);
    expect(res.body.data).toHaveProperty('evidenceSummary');
    expect(res.body.data).toHaveProperty('supportingEvents');
    expect(Array.isArray(res.body.data.supportingEvents)).toBe(true);
  });

  it('PATCH /api/alerts/:id/status: should update triage status of an alert', async () => {
    expect(sampleAlertId).toBeTruthy();

    const res = await request(app)
      .patch(`/api/alerts/${sampleAlertId}/status`)
      .send({ status: 'investigating' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('investigating');

    // Resolve alert
    const resResolve = await request(app)
      .patch(`/api/alerts/${sampleAlertId}/status`)
      .send({ status: 'resolved' });

    expect(resResolve.status).toBe(200);
    expect(resResolve.body.data.status).toBe('resolved');
  });

  it('PATCH /api/alerts/:id/status: should reject invalid status values with 422', async () => {
    expect(sampleAlertId).toBeTruthy();

    const res = await request(app)
      .patch(`/api/alerts/${sampleAlertId}/status`)
      .send({ status: 'not_a_real_status' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});
