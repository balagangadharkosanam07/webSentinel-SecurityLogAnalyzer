import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Health API Endpoint (GET /api/health)', () => {
  const app = createApp();

  it('should return 200 OK with standard response envelope', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toHaveProperty('timestamp');

    const data = res.body.data;
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('websentinel-api');
    expect(data).toHaveProperty('uptime_seconds');
    expect(data.system).toHaveProperty('node_version');
    expect(data.system).toHaveProperty('memory_rss_mb');
  });

  it('should include X-Request-Id header in the response', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
  });
});
