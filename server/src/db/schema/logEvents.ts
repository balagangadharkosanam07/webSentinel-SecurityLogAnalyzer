import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const logEvents = pgTable(
  'log_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    sourceIp: varchar('source_ip', { length: 64 }).notNull(),
    method: varchar('method', { length: 16 }).notNull(),
    endpoint: varchar('endpoint', { length: 512 }).notNull(),
    statusCode: integer('status_code').notNull(),
    actorId: varchar('actor_id', { length: 64 }),
    actorRole: varchar('actor_role', { length: 32 }),
    requestId: varchar('request_id', { length: 64 }).notNull(),
    sourceApp: varchar('source_app', { length: 64 }).default('attendance-portal').notNull(),
    message: text('message').notNull(),
    durationMs: integer('duration_ms'),
    metadata: jsonb('metadata').default({}).notNull(),
    dedupId: varchar('dedup_id', { length: 128 }).notNull(),
    isSuspicious: boolean('is_suspicious').default(false).notNull(),
    isSynthetic: boolean('is_synthetic').default(false).notNull(),
  },
  (table) => [
    index('idx_log_events_timestamp').on(table.timestamp),
    index('idx_log_events_source_ip').on(table.sourceIp),
    index('idx_log_events_event_type').on(table.eventType),
    uniqueIndex('idx_log_events_dedup_id').on(table.dedupId),
  ]
);

export type LogEventModel = typeof logEvents.$inferSelect;
export type NewLogEvent = typeof logEvents.$inferInsert;
