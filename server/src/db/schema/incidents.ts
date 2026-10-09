import { pgTable, varchar, text, integer, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';

export const incidents = pgTable('incidents', {
  id: varchar('id', { length: 32 }).primaryKey(),
  title: varchar('title', { length: 256 }).notNull(),
  description: text('description').notNull(),
  severity: varchar('severity', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).default('open').notNull(),
  primarySourceIp: varchar('primary_source_ip', { length: 64 }).notNull(),
  targetedAsset: varchar('targeted_asset', { length: 256 }).notNull(),
  riskScore: integer('risk_score').notNull(),
  riskBreakdown: jsonb('risk_breakdown').notNull(),
  firstSeen: timestamp('first_seen', { withTimezone: true, mode: 'string' }).notNull(),
  lastSeen: timestamp('last_seen', { withTimezone: true, mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  isSynthetic: boolean('is_synthetic').default(false).notNull(),
});

export type IncidentModel = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
