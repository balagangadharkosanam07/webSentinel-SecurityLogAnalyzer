import { db } from '../db/index.js';
import { alerts, AlertModel, NewAlert, logEvents, LogEventModel } from '../db/schema/index.js';
import { eq, desc, and, or, ilike, sql, inArray, SQL } from 'drizzle-orm';

export interface AlertQueryFilters {
  severity?: string;
  status?: string;
  ruleId?: string;
  sourceIp?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AlertWithSupportingEvents extends AlertModel {
  supportingEvents?: LogEventModel[];
}

function buildAlertWhereClause(filters: AlertQueryFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.severity && filters.severity !== 'all') {
    conditions.push(eq(alerts.severity, filters.severity));
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push(eq(alerts.status, filters.status));
  }
  if (filters.ruleId && filters.ruleId !== 'all') {
    conditions.push(eq(alerts.ruleId, filters.ruleId));
  }
  if (filters.sourceIp && filters.sourceIp !== 'all') {
    conditions.push(eq(alerts.sourceIp, filters.sourceIp));
  }

  if (filters.search && filters.search.trim().length > 0) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(alerts.title, term),
        ilike(alerts.description, term),
        ilike(alerts.sourceIp, term),
        ilike(alerts.evidenceSummary, term)
      )!
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export const alertsRepository = {
  /**
   * Find all alerts
   */
  async findAll(): Promise<AlertModel[]> {
    return this.findMany();
  },

  /**
   * Bulk insert alerts idempotently
   */
  async createMany(data: NewAlert[]): Promise<AlertModel[]> {
    if (data.length === 0) return [];
    return await db
      .insert(alerts)
      .values(data)
      .onConflictDoNothing({ target: alerts.id })
      .returning();
  },

  /**
   * Find alert by primary ID
   */
  async findById(id: string): Promise<AlertWithSupportingEvents | null> {
    const res = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
    if (!res[0]) return null;

    const alert = res[0];
    let supportingEvents: LogEventModel[] = [];

    const eventIds = alert.supportingEventIds as string[];
    if (Array.isArray(eventIds) && eventIds.length > 0) {
      supportingEvents = await db
        .select()
        .from(logEvents)
        .where(inArray(logEvents.id, eventIds));
    }

    return {
      ...alert,
      supportingEvents,
    };
  },

  /**
   * Query filtered, paginated alerts
   */
  async findMany(filters: AlertQueryFilters = {}): Promise<AlertModel[]> {
    const where = buildAlertWhereClause(filters);

    return await db
      .select()
      .from(alerts)
      .where(where)
      .orderBy(desc(alerts.detectedAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  },

  /**
   * Count alerts matching filters
   */
  async count(filters: AlertQueryFilters = {}): Promise<number> {
    const where = buildAlertWhereClause(filters);
    const res = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(alerts)
      .where(where);

    return Number(res[0]?.total ?? 0);
  },

  /**
   * Update triage status of an alert
   */
  async updateStatus(id: string, status: string): Promise<AlertModel | null> {
    const res = await db
      .update(alerts)
      .set({ status })
      .where(eq(alerts.id, id))
      .returning();
    return res[0] || null;
  },
};
