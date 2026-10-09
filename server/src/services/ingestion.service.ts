import { db } from '../db/index.js';
import { logEvents, ingestionBatches, NewLogEvent, LogEventModel } from '../db/schema/index.js';
import { validateAndNormalizeRecord } from '../validators/logContract.validator.js';
import { logger } from '../utils/logger.js';

export interface IngestionItemRejection {
  index: number;
  errors: string[];
  sample?: unknown;
}

export interface IngestionBatchResult {
  batchId: string;
  sourceApp: string;
  totalRecords: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  status: 'completed' | 'partial' | 'failed';
  rejectedItems: IngestionItemRejection[];
  insertedEvents: LogEventModel[];
}

export const ingestionService = {
  /**
   * Processes a raw batch of logs through the 7-stage ingestion pipeline
   */
  async processBatch(
    rawRecords: unknown[],
    defaultSourceApp = 'attendance-portal'
  ): Promise<IngestionBatchResult> {
    const validRecords: NewLogEvent[] = [];
    const rejectedItems: IngestionItemRejection[] = [];

    // Stage 2, 3, 4, 5: Validate, Sanitize, Normalize, and Deduplicate Hashing
    rawRecords.forEach((item, index) => {
      const outcome = validateAndNormalizeRecord(item);

      if (outcome.success) {
        validRecords.push(outcome.normalized);
      } else {
        rejectedItems.push({
          index,
          errors: outcome.errors,
          sample: typeof item === 'object' && item !== null ? item : String(item),
        });
      }
    });

    let insertedEvents: LogEventModel[] = [];
    let duplicateCount = 0;

    // Stage 6: Idempotent Persistence into Neon PostgreSQL
    if (validRecords.length > 0) {
      try {
        const insertResults = await db
          .insert(logEvents)
          .values(validRecords)
          .onConflictDoNothing({ target: logEvents.dedupId })
          .returning();

        insertedEvents = insertResults;
        duplicateCount = validRecords.length - insertResults.length;
      } catch (err) {
        logger.error('Failed to persist valid records in database', {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }

    const acceptedCount = insertedEvents.length;
    const rejectedCount = rejectedItems.length;

    // Determine batch status accurately
    let status: 'completed' | 'partial' | 'failed' = 'completed';
    if (rejectedCount > 0 && acceptedCount === 0 && duplicateCount === 0) {
      status = 'failed';
    } else if (rejectedCount > 0 || duplicateCount > 0) {
      status = 'partial';
    } else {
      status = 'completed';
    }

    // Stage 7: Record Ingestion Batch in Audit Table
    const [batchRecord] = await db
      .insert(ingestionBatches)
      .values({
        sourceApp: defaultSourceApp,
        totalRecords: rawRecords.length,
        acceptedRecords: acceptedCount,
        rejectedRecords: rejectedCount,
        status,
        errorSummary: rejectedItems.map((r) => ({ index: r.index, errors: r.errors })),
      })
      .returning();

    logger.info(
      `Ingestion Batch [${batchRecord.id}]: Total=${rawRecords.length} Accepted=${acceptedCount} Rejected=${rejectedCount} Duplicates=${duplicateCount} Status=${status}`
    );

    return {
      batchId: batchRecord.id,
      sourceApp: defaultSourceApp,
      totalRecords: rawRecords.length,
      acceptedCount,
      rejectedCount,
      duplicateCount,
      status,
      rejectedItems,
      insertedEvents,
    };
  },

  /**
   * Retrieves recent ingestion batches for audit review
   */
  async getRecentBatches(limit = 20) {
    return await db.query.ingestionBatches.findMany({
      orderBy: (batches, { desc }) => [desc(batches.receivedAt)],
      limit,
    });
  },

  /**
   * Retrieves specific batch details by ID
   */
  async getBatchById(id: string) {
    return await db.query.ingestionBatches.findFirst({
      where: (batches, { eq }) => eq(batches.id, id),
    });
  },
};
