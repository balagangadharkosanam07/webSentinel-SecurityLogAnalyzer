import { db } from '../db/index.js';
import { logEvents, NewLogEvent, LogEventModel } from '../db/schema/index.js';
import { eq, desc, asc, and, or, gte, lte, ilike, sql, SQL } from 'drizzle-orm';

export interface LogQueryFilter {
  search?: string;
  eventType?: string;
  sourceIp?: string;
  statusCode?: number;
  startDate?: string;
  endDate?: string;
  onlySuspicious?: boolean;
  sortBy?: 'timestamp' | 'statusCode';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

function buildWhereClause(filters: LogQueryFilter): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.eventType && filters.eventType !== 'all') {
    conditions.push(eq(logEvents.eventType, filters.eventType));
  }
  if (filters.sourceIp && filters.sourceIp !== 'all') {
    conditions.push(eq(logEvents.sourceIp, filters.sourceIp));
  }
  if (filters.statusCode) {
    conditions.push(eq(logEvents.statusCode, filters.statusCode));
  }
  if (filters.onlySuspicious) {
    conditions.push(eq(logEvents.isSuspicious, true));
  }
  if (filters.startDate) {
    conditions.push(gte(logEvents.timestamp, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(logEvents.timestamp, filters.endDate));
  }

  if (filters.search && filters.search.trim().length > 0) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(logEvents.endpoint, term),
        ilike(logEvents.sourceIp, term),
        ilike(logEvents.message, term),
        ilike(logEvents.requestId, term),
        ilike(logEvents.actorId, term)
      )!
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export const logEventsRepository = {
  /**
   * Insert a single log record with deduplication conflict handling
   */
  async create(data: NewLogEvent): Promise<LogEventModel | null> {
    const results = await db
      .insert(logEvents)
      .values(data)
      .onConflictDoNothing({ target: logEvents.dedupId })
      .returning();

    return results[0] || null;
  },

  /**
   * Bulk insert log records with deduplication
   */
  async createMany(data: NewLogEvent[]): Promise<LogEventModel[]> {
    if (data.length === 0) return [];
    return await db
      .insert(logEvents)
      .values(data)
      .onConflictDoNothing({ target: logEvents.dedupId })
      .returning();
  },

  /**
   * Find log event by primary UUID
   */
  async findById(id: string): Promise<LogEventModel | null> {
    const results = await db.select().from(logEvents).where(eq(logEvents.id, id)).limit(1);
    return results[0] || null;
  },

  /**
   * Query filtered, paginated log events with server-side sorting and search
   */
  async findMany(filters: LogQueryFilter = {}): Promise<LogEventModel[]> {
    const where = buildWhereClause(filters);

    let orderExpr;
    if (filters.sortBy === 'statusCode') {
      orderExpr = filters.sortOrder === 'asc' ? asc(logEvents.statusCode) : desc(logEvents.statusCode);
    } else {
      orderExpr = filters.sortOrder === 'asc' ? asc(logEvents.timestamp) : desc(logEvents.timestamp);
    }

    const query = db
      .select()
      .from(logEvents)
      .where(where)
      .orderBy(orderExpr)
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    return await query;
  },

  /**
   * Count log events matching the specified filters
   */
  async count(filters: LogQueryFilter = {}): Promise<number> {
    const where = buildWhereClause(filters);
    const res = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(logEvents)
      .where(where);

    return Number(res[0]?.total ?? 0);
  },

  /**
   * Get distinct event types present in the database for dropdown filtering
   */
  async getDistinctEventTypes(): Promise<string[]> {
    const res = await db
      .selectDistinct({ eventType: logEvents.eventType })
      .from(logEvents)
      .orderBy(asc(logEvents.eventType));

    return res.map((r) => r.eventType);
  },

  /**
   * Get distinct source IPs present in the database for dropdown filtering
   */
  async getDistinctSourceIps(): Promise<string[]> {
    const res = await db
      .selectDistinct({ sourceIp: logEvents.sourceIp })
      .from(logEvents)
      .orderBy(asc(logEvents.sourceIp));

    return res.map((r) => r.sourceIp);
  },
};
