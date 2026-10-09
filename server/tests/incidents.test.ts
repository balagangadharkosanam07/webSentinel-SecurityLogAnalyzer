import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Incident Correlation & Explainable Risk Scoring API (Phase 8)', () => {
  const app = createApp();
  let sampleIncidentId = '';

  it('POST /api/incidents/correlate: should cluster alerts into incidents with explainable risk scores', async () => {
    // Ensure logs and alerts exist
    await request(app).post('/api/logs/seed-all');
    await request(app).post('/api/detection/run').send({ limit: 500 });

    const res = await request(app).post('/api/incidents/correlate');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('incidentsCreated');
    expect(res.body.data).toHaveProperty('alertsLinked');
    expect(res.body.data.incidentsCreated).toBeGreaterThan(0);
  }, 60000);

  it('GET /api/incidents: should list correlated incidents with pagination and severity support', async () => {
    const res = await request(app).get('/api/incidents?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.meta).toHaveProperty('page');

    sampleIncidentId = res.body.data[0].id;
  });

  it('Explainable Risk Score: incident must have mathematical risk breakdown bounded 0-100 with rationale', async () => {
    expect(sampleIncidentId).toBeTruthy();

    const res = await request(app).get(`/api/incidents/${sampleIncidentId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const inc = res.body.data;
    expect(inc.riskScore).toBeGreaterThanOrEqual(0);
    expect(inc.riskScore).toBeLessThanOrEqual(100);

    const breakdown = inc.riskBreakdown;
    expect(breakdown).toHaveProperty('base_score');
    expect(breakdown).toHaveProperty('frequency_multiplier');
    expect(breakdown).toHaveProperty('criticality_weight');
    expect(breakdown).toHaveProperty('unauthorized_factor');
    expect(breakdown).toHaveProperty('total_score');
    expect(breakdown).toHaveProperty('rationale');
    expect(typeof breakdown.rationale).toBe('string');
    expect(breakdown.rationale.length).toBeGreaterThan(10);
  });

  it('GET /api/incidents/:id: should return linked alerts and chronological kill-chain timeline steps', async () => {
    expect(sampleIncidentId).toBeTruthy();

    const res = await request(app).get(`/api/incidents/${sampleIncidentId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.alerts)).toBe(true);
    expect(Array.isArray(res.body.data.timeline)).toBe(true);

    // If timeline steps exist, verify chronological ordering
    const timeline = res.body.data.timeline;
    if (timeline.length > 1) {
      for (let i = 1; i < timeline.length; i++) {
        const prev = new Date(timeline[i - 1].timestamp).getTime();
        const curr = new Date(timeline[i].timestamp).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    }
  });

  it('PATCH /api/incidents/:id/status: should update incident triage status', async () => {
    expect(sampleIncidentId).toBeTruthy();

    const res = await request(app)
      .patch(`/api/incidents/${sampleIncidentId}/status`)
      .send({ status: 'investigating' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('investigating');

    // Mitigate incident
    const resMitigate = await request(app)
      .patch(`/api/incidents/${sampleIncidentId}/status`)
      .send({ status: 'mitigated' });

    expect(resMitigate.status).toBe(200);
    expect(resMitigate.body.data.status).toBe('mitigated');
  });

  it('PATCH /api/incidents/:id/status: should reject invalid status with 422', async () => {
    expect(sampleIncidentId).toBeTruthy();

    const res = await request(app)
      .patch(`/api/incidents/${sampleIncidentId}/status`)
      .send({ status: 'fake_status_string' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});
