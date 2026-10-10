import { db } from '../db/index.js';
import {
  incidents,
  IncidentModel,
  NewIncident,
  alerts,
  AlertModel,
  logEvents,
  LogEventModel,
} from '../db/schema/index.js';
import { eq, desc, and, or, ilike, sql, inArray, SQL } from 'drizzle-orm';

export interface IncidentQueryFilters {
  severity?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TimelineStep {
  id: string;
  timestamp: string;
  phase:
    | 'Reconnaissance'
    | 'Credential Access'
    | 'Initial Access'
    | 'Privilege Escalation'
    | 'Execution'
    | 'Impact';
  method: string;
  endpoint: string;
  statusCode: number;
  sourceIp: string;
  actorId: string | null;
  message: string;
}

export interface IncidentWithDetails extends IncidentModel {
  alerts: AlertModel[];
  timeline: TimelineStep[];
}

function buildIncidentWhereClause(filters: IncidentQueryFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.severity && filters.severity !== 'all') {
    conditions.push(eq(incidents.severity, filters.severity));
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push(eq(incidents.status, filters.status));
  }

  if (filters.search && filters.search.trim().length > 0) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(incidents.title, term),
        ilike(incidents.description, term),
        ilike(incidents.primarySourceIp, term),
        ilike(incidents.targetedAsset, term)
      )!
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function mapEventToTimelinePhase(evt: LogEventModel): TimelineStep['phase'] {
  if (evt.eventType === 'sql_injection_attempt' || evt.eventType === 'xss_attempt') {
    return 'Execution';
  }
  if (evt.eventType === 'attendance_modify' || evt.endpoint.includes('/attendance')) {
    return 'Impact';
  }
  if (evt.statusCode === 403 || evt.eventType === 'permission_denied' || evt.eventType === 'access_denied') {
    return 'Privilege Escalation';
  }
  if (evt.eventType === 'login_success' || (evt.statusCode === 200 && evt.endpoint.includes('/login'))) {
    return 'Initial Access';
  }
  if (evt.eventType === 'login_failed' || evt.statusCode === 401) {
    return 'Credential Access';
  }
  return 'Reconnaissance';
}

export const incidentsRepository = {
  async findAll(): Promise<IncidentModel[]> {
    return await db.select().from(incidents).orderBy(desc(incidents.firstSeen));
  },

  async findById(id: string): Promise<IncidentModel | null> {
    const res = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    return res[0] || null;
  },

  async create(data: NewIncident): Promise<IncidentModel | null> {
    const res = await db
      .insert(incidents)
      .values(data)
      .onConflictDoNothing({ target: incidents.id })
      .returning();
    return res[0] || null;
  },

  async upsert(data: NewIncident): Promise<IncidentModel> {
    const res = await db
      .insert(incidents)
      .values(data)
      .onConflictDoUpdate({
        target: incidents.id,
        set: {
          title: data.title,
          description: data.description,
          severity: data.severity,
          lastSeen: data.lastSeen,
          riskScore: data.riskScore,
          riskBreakdown: data.riskBreakdown,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();
    return res[0];
  },

  async createMany(data: NewIncident[]): Promise<IncidentModel[]> {
    if (data.length === 0) return [];
    return await db
      .insert(incidents)
      .values(data)
      .onConflictDoNothing({ target: incidents.id })
      .returning();
  },

  async findMany(filters: IncidentQueryFilters = {}): Promise<IncidentModel[]> {
    const where = buildIncidentWhereClause(filters);
    return await db
      .select()
      .from(incidents)
      .where(where)
      .orderBy(desc(incidents.firstSeen))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  },

  async count(filters: IncidentQueryFilters = {}): Promise<number> {
    const where = buildIncidentWhereClause(filters);
    const res = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(incidents)
      .where(where);
    return Number(res[0]?.total ?? 0);
  },

  async updateStatus(id: string, status: string): Promise<IncidentModel | null> {
    const res = await db
      .update(incidents)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(incidents.id, id))
      .returning();
    return res[0] || null;
  },

  async linkAlertsToIncident(incidentId: string, alertIds: string[]): Promise<void> {
    if (alertIds.length === 0) return;
    await db
      .update(alerts)
      .set({ incidentId })
      .where(inArray(alerts.id, alertIds));
  },

  async findByIdWithDetails(id: string): Promise<IncidentWithDetails | null> {
    const incident = await this.findById(id);
    if (!incident) return null;

    // Load correlated alerts
    const linkedAlerts = await db
      .select()
      .from(alerts)
      .where(eq(alerts.incidentId, id))
      .orderBy(alerts.detectedAt);

    // Collect all supporting log event IDs from linked alerts
    const allEventIds: string[] = [];
    linkedAlerts.forEach((a) => {
      const ids = a.supportingEventIds as string[];
      if (Array.isArray(ids)) {
        ids.forEach((eid) => {
          if (!allEventIds.includes(eid)) allEventIds.push(eid);
        });
      }
    });

    let rawEvents: LogEventModel[] = [];
    if (allEventIds.length > 0) {
      rawEvents = await db
        .select()
        .from(logEvents)
        .where(inArray(logEvents.id, allEventIds));
    }

    // Sort events chronologically ascending to reconstruct the kill chain
    rawEvents.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const timeline: TimelineStep[] = rawEvents.map((evt) => ({
      id: evt.id,
      timestamp: evt.timestamp,
      phase: mapEventToTimelinePhase(evt),
      method: evt.method,
      endpoint: evt.endpoint,
      statusCode: evt.statusCode,
      sourceIp: evt.sourceIp,
      actorId: evt.actorId,
      message: evt.message,
    }));

    return {
      ...incident,
      alerts: linkedAlerts,
      timeline,
    };
  },
};
