import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('SOC Analytics & Audit Reporting API (Phase 9)', () => {
  const app = createApp();

  it('GET /api/analytics/overview: should return SOC overview metrics, trends, and recent telemetry', async () => {
    // Seed and execute detection & correlation if needed
    await request(app).post('/api/logs/seed-all');
    await request(app).post('/api/detection/run').send({ limit: 500 });
    await request(app).post('/api/incidents/correlate');

    const res = await request(app).get('/api/analytics/overview');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data).toHaveProperty('totalEvents');
    expect(data).toHaveProperty('suspiciousEvents');
    expect(data).toHaveProperty('suspiciousRatio');
    expect(data).toHaveProperty('openIncidents');
    expect(data).toHaveProperty('criticalAlerts');
    expect(data).toHaveProperty('eventTrends');
    expect(data).toHaveProperty('severityDistribution');
    expect(data).toHaveProperty('recentAlerts');
    expect(data).toHaveProperty('recentEvents');

    expect(data.totalEvents).toBeGreaterThan(0);
    expect(Array.isArray(data.eventTrends)).toBe(true);
    expect(Array.isArray(data.severityDistribution)).toBe(true);
  }, 60000);

  it('GET /api/analytics/risk: should return rule frequency, top threat IPs, and targeted endpoints', async () => {
    const res = await request(app).get('/api/analytics/risk');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data).toHaveProperty('ruleStats');
    expect(data).toHaveProperty('topSuspiciousIps');
    expect(data).toHaveProperty('targetedEndpoints');
    expect(data).toHaveProperty('severityDistribution');

    expect(Array.isArray(data.ruleStats)).toBe(true);
    expect(data.ruleStats.length).toBeGreaterThan(0);
    expect(Array.isArray(data.topSuspiciousIps)).toBe(true);
    expect(Array.isArray(data.targetedEndpoints)).toBe(true);
  });

  it('GET /api/reports/summary: should return executive audit findings and period breakdown', async () => {
    const res = await request(app).get('/api/reports/summary?period=24h');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const report = res.body.data;
    expect(report).toHaveProperty('period', '24h');
    expect(report).toHaveProperty('totalEvents');
    expect(report).toHaveProperty('totalAlerts');
    expect(report).toHaveProperty('totalIncidents');
    expect(report).toHaveProperty('keyFindings');
    expect(report).toHaveProperty('limitations');
    expect(Array.isArray(report.keyFindings)).toBe(true);
    expect(report.keyFindings.length).toBeGreaterThan(0);
  });

  it('GET /api/reports/export: should stream CSV log report with proper headers', async () => {
    const res = await request(app).get('/api/reports/export?period=24h');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('Event_ID,Timestamp_UTC,Event_Type');
    expect(res.text.split('\n').length).toBeGreaterThan(1);
  });
});
