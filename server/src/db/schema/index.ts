import { relations } from 'drizzle-orm';
import { detectionRules } from './detectionRules.js';
import { incidents } from './incidents.js';
import { alerts } from './alerts.js';

export * from './logEvents.js';
export * from './detectionRules.js';
export * from './incidents.js';
export * from './alerts.js';
export * from './ingestionBatches.js';

// Relations
export const detectionRulesRelations = relations(detectionRules, ({ many }) => ({
  alerts: many(alerts),
}));

export const incidentsRelations = relations(incidents, ({ many }) => ({
  alerts: many(alerts),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  rule: one(detectionRules, {
    fields: [alerts.ruleId],
    references: [detectionRules.id],
  }),
  incident: one(incidents, {
    fields: [alerts.incidentId],
    references: [incidents.id],
  }),
}));
