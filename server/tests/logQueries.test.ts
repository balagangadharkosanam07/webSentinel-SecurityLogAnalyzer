import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Log Explorer Query & Filter API (GET /api/logs)', () => {
  const app = createApp();

  it('Seed-all: should successfully ingest synthetic attack datasets into Neon DB', async () => {
    const res = await request(app).post('/api/logs/seed-all');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalLogsInDatabase');
    expect(res.body.data.batches.length).toBeGreaterThan(0);
  });

  it('GET /api/logs/metadata: should return distinct event types and source IPs', async () => {
    const res = await request(app).get('/api/logs/metadata');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.eventTypes)).toBe(true);
    expect(Array.isArray(res.body.data.sourceIps)).toBe(true);
    expect(res.body.data.totalCount).toBeGreaterThan(0);
  });

  it('Pagination: should return paginated records with page, limit, totalPages, and total meta', async () => {
    const limit = 5;
    const res = await request(app).get(`/api/logs?page=1&limit=${limit}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(limit);
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(1);
    expect(res.body.data.length).toBeLessThanOrEqual(limit);
  });

  it('Search Filter: should filter records by search keyword in endpoint, IP, or message', async () => {
    const res = await request(app).get('/api/logs?search=login');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const log of res.body.data) {
      const match =
        log.endpoint.toLowerCase().includes('login') ||
        log.message.toLowerCase().includes('login') ||
        log.eventType.toLowerCase().includes('login');
      expect(match).toBe(true);
    }
  });

  it('Suspicious Filter: should only return records marked as suspicious when only_suspicious=true', async () => {
    const res = await request(app).get('/api/logs?only_suspicious=true');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const log of res.body.data) {
      expect(log.isSuspicious).toBe(true);
    }
  });

  it('Status Code Sorting: should respect sort_by=status_code and sort_order=desc', async () => {
    const res = await request(app).get('/api/logs?sort_by=status_code&sort_order=desc&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const codes = res.body.data.map((l: any) => l.statusCode);
    for (let i = 1; i < codes.length; i++) {
      expect(codes[i - 1]).toBeGreaterThanOrEqual(codes[i]);
    }
  });
});
