import { pgTable, varchar, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import { detectionRules } from './detectionRules.js';
import { incidents } from './incidents.js';

export const alerts = pgTable('alerts', {
  id: varchar('id', { length: 32 }).primaryKey(),
  ruleId: varchar('rule_id', { length: 32 })
    .references(() => detectionRules.id)
    .notNull(),
  incidentId: varchar('incident_id', { length: 32 }).references(() => incidents.id),
  title: varchar('title', { length: 256 }).notNull(),
  description: text('description').notNull(),
  severity: varchar('severity', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).default('open').notNull(),
  sourceIp: varchar('source_ip', { length: 64 }).notNull(),
  actorId: varchar('actor_id', { length: 64 }),
  evidenceStrength: varchar('evidence_strength', { length: 32 }).notNull(),
  evidenceSummary: text('evidence_summary').notNull(),
  supportingEventIds: jsonb('supporting_event_ids').default([]).notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true, mode: 'string' }).notNull(),
  isSynthetic: boolean('is_synthetic').default(false).notNull(),
});

export type AlertModel = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
