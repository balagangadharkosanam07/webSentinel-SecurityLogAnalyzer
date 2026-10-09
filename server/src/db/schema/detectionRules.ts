import { pgTable, varchar, text, boolean, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const detectionRules = pgTable('detection_rules', {
  id: varchar('id', { length: 32 }).primaryKey(),
  name: varchar('name', { length: 256 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 64 }).notNull(),
  severity: varchar('severity', { length: 32 }).notNull(), // critical, high, medium, low, info
  configuration: jsonb('configuration').default({}).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export type DetectionRuleModel = typeof detectionRules.$inferSelect;
export type NewDetectionRule = typeof detectionRules.$inferInsert;
