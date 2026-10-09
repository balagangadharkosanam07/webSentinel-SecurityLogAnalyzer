import { describe, it, expect } from 'vitest';
import { checkDatabaseConnection } from '../src/db/index.js';
import { detectionRulesRepository } from '../src/repositories/detectionRules.repository.js';
import { incidentsRepository } from '../src/repositories/incidents.repository.js';
import { alertsRepository } from '../src/repositories/alerts.repository.js';
import { logEventsRepository } from '../src/repositories/logEvents.repository.js';

describe('PostgreSQL & Drizzle ORM Live Database Integration', () => {
  it('should successfully establish SSL connection to Neon PostgreSQL', async () => {
    const status = await checkDatabaseConnection();
    expect(status.connected).toBe(true);
    expect(status.version).toBeDefined();
    expect(status.version).toContain('PostgreSQL');
  });

  it('should read seeded detection rules from database', async () => {
    const rules = await detectionRulesRepository.findAll();
    expect(rules.length).toBeGreaterThanOrEqual(6);

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain('RULE-001');
    expect(ruleIds).toContain('RULE-002');
    expect(ruleIds).toContain('RULE-006');
  });

  it('should read correlated incidents with explainable risk scores', async () => {
    const incidents = await incidentsRepository.findAll();
    expect(incidents.length).toBeGreaterThanOrEqual(3);

    const inc1 = incidents.find((i) => i.id === 'INC-2026-001');
    expect(inc1).toBeDefined();
    expect(inc1?.riskScore).toBe(90);
    expect(inc1?.riskBreakdown).toHaveProperty('base_score');
  });

  it('should read alerts linked to detection rules', async () => {
    const alerts = await alertsRepository.findAll();
    expect(alerts.length).toBeGreaterThanOrEqual(6);

    const alt1 = alerts.find((a) => a.id === 'ALT-2026-001');
    expect(alt1).toBeDefined();
    expect(alt1?.ruleId).toBe('RULE-002');
  });

  it('should read normalized log events with pagination and filters', async () => {
    const events = await logEventsRepository.findMany({ limit: 10 });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toHaveProperty('dedupId');
    expect(events[0]).toHaveProperty('sourceIp');
  });

  it('DEDUPLICATION: inserting an existing dedup_id must be safely ignored without throwing', async () => {
    const existingEvents = await logEventsRepository.findMany({ limit: 1 });
    const existing = existingEvents[0];
    expect(existing).toBeDefined();

    // Attempt to insert duplicate record with identical dedup_id
    const duplicateAttempt = await logEventsRepository.create({
      timestamp: existing.timestamp,
      eventType: existing.eventType,
      sourceIp: existing.sourceIp,
      method: existing.method,
      endpoint: existing.endpoint,
      statusCode: existing.statusCode,
      actorId: existing.actorId,
      actorRole: existing.actorRole,
      requestId: 'req-dup-test',
      sourceApp: existing.sourceApp,
      message: 'Duplicate event test',
      metadata: {},
      dedupId: existing.dedupId, // Conflicting unique key
      isSuspicious: existing.isSuspicious,
      isSynthetic: true,
    });

    // onConflictDoNothing returns null for duplicate
    expect(duplicateAttempt).toBeNull();
  });
});
