import { pgTable, uuid, varchar, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const ingestionBatches = pgTable('ingestion_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceApp: varchar('source_app', { length: 64 }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  totalRecords: integer('total_records').notNull(),
  acceptedRecords: integer('accepted_records').notNull(),
  rejectedRecords: integer('rejected_records').notNull(),
  status: varchar('status', { length: 32 }).notNull(), // completed, partial, failed
  errorSummary: jsonb('error_summary').default([]).notNull(),
});

export type IngestionBatchModel = typeof ingestionBatches.$inferSelect;
export type NewIngestionBatch = typeof ingestionBatches.$inferInsert;
