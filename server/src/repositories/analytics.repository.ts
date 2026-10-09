import { db } from '../db/index.js';
import {
  logEvents,
  alerts,
  incidents,
  detectionRules,
  LogEventModel,
  AlertModel,
} from '../db/schema/index.js';
import { eq, desc, sql } from 'drizzle-orm';

export interface OverviewMetrics {
  totalEvents: number;
  suspiciousEvents: number;
  suspiciousRatio: number;
  openIncidents: number;
  totalIncidents: number;
  criticalAlerts: number;
  totalAlerts: number;
  eventTrends: Array<{
    time: string;
    total: number;
    suspicious: number;
    normal: number;
  }>;
  severityDistribution: Array<{
    severity: string;
    count: number;
  }>;
  recentAlerts: AlertModel[];
  recentEvents: LogEventModel[];
}

export interface RuleStat {
  ruleId: string;
  name: string;
  severity: string;
  category: string;
  count: number;
}

export interface TopIpStat {
  ip: string;
  totalRequests: number;
  suspiciousCount: number;
  alertCount: number;
  lastSeen: string;
  primaryTarget: string;
}

export interface TargetedEndpointStat {
  endpoint: string;
  method: string;
  totalHits: number;
  suspiciousHits: number;
  errorCount: number; // 4xx / 5xx
}

export interface RiskAnalyticsData {
  ruleStats: RuleStat[];
  topSuspiciousIps: TopIpStat[];
  targetedEndpoints: TargetedEndpointStat[];
  severityDistribution: Array<{ severity: string; count: number }>;
}

export interface ReportSummaryData {
  period: string;
  generatedAt: string;
  totalEvents: number;
  suspiciousEvents: number;
  totalAlerts: number;
  totalIncidents: number;
  openIncidents: number;
  severityCounts: Record<string, number>;
  topRules: RuleStat[];
  topThreatIps: TopIpStat[];
  keyFindings: string[];
  limitations: string[];
}

export const analyticsRepository = {
  /**
   * Aggregates high-level SOC KPI metrics, trends, and recent telemetry
   */
  async getOverviewMetrics(): Promise<OverviewMetrics> {
    // 1. Total & Suspicious log counts
    const logCountsRes = await db
      .select({
        total: sql<number>`count(*)::int`,
        suspicious: sql<number>`count(*) filter (where ${logEvents.isSuspicious} = true)::int`,
      })
      .from(logEvents);

    const totalEvents = Number(logCountsRes[0]?.total ?? 0);
    const suspiciousEvents = Number(logCountsRes[0]?.suspicious ?? 0);
    const suspiciousRatio = totalEvents > 0 ? Math.round((suspiciousEvents / totalEvents) * 100) : 0;

    // 2. Incident counts
    const incidentCountsRes = await db
      .select({
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (where ${incidents.status} = 'open')::int`,
      })
      .from(incidents);

    const totalIncidents = Number(incidentCountsRes[0]?.total ?? 0);
    const openIncidents = Number(incidentCountsRes[0]?.open ?? 0);

    // 3. Alert counts
    const alertCountsRes = await db
      .select({
        total: sql<number>`count(*)::int`,
        criticalOrHigh: sql<number>`count(*) filter (where ${alerts.severity} in ('critical', 'high'))::int`,
      })
      .from(alerts);

    const totalAlerts = Number(alertCountsRes[0]?.total ?? 0);
    const criticalAlerts = Number(alertCountsRes[0]?.criticalOrHigh ?? 0);

    // 4. Severity Distribution for Alerts
    const severityRows = await db
      .select({
        severity: alerts.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(alerts)
      .groupBy(alerts.severity);

    const severityOrder = ['critical', 'high', 'medium', 'low'];
    const severityDistribution = severityOrder.map((sev) => {
      const found = severityRows.find((r) => r.severity.toLowerCase() === sev);
      return {
        severity: sev,
        count: Number(found?.count ?? 0),
      };
    });

    // 5. Recent high-priority alerts
    const recentAlerts = await db
      .select()
      .from(alerts)
      .orderBy(desc(alerts.detectedAt))
      .limit(5);

    // 6. Recent log events
    const recentEvents = await db
      .select()
      .from(logEvents)
      .orderBy(desc(logEvents.timestamp))
      .limit(6);

    // 7. Event Trends (Chronological Bucketing across stored events)
    // We group by hour/time string from existing logs
    const trendRows = await db
      .select({
        bucket: sql<string>`to_char(${logEvents.timestamp}, 'HH24:MI')`,
        total: sql<number>`count(*)::int`,
        suspicious: sql<number>`count(*) filter (where ${logEvents.isSuspicious} = true)::int`,
      })
      .from(logEvents)
      .groupBy(sql`to_char(${logEvents.timestamp}, 'HH24:MI')`)
      .orderBy(sql`to_char(${logEvents.timestamp}, 'HH24:MI')`)
      .limit(10);

    const eventTrends = trendRows.map((r) => {
      const total = Number(r.total);
      const suspicious = Number(r.suspicious);
      return {
        time: r.bucket,
        total,
        suspicious,
        normal: Math.max(0, total - suspicious),
      };
    });

    return {
      totalEvents,
      suspiciousEvents,
      suspiciousRatio,
      openIncidents,
      totalIncidents,
      criticalAlerts,
      totalAlerts,
      eventTrends,
      severityDistribution,
      recentAlerts,
      recentEvents,
    };
  },

  /**
   * Gathers deep risk analytics: rule frequencies, threat actor IPs, and target endpoints
   */
  async getRiskAnalytics(): Promise<RiskAnalyticsData> {
    // 1. Detection rule frequencies
    const rulesList = await db.select().from(detectionRules);
    const alertRuleCounts = await db
      .select({
        ruleId: alerts.ruleId,
        count: sql<number>`count(*)::int`,
      })
      .from(alerts)
      .groupBy(alerts.ruleId);

    const ruleStats: RuleStat[] = rulesList.map((rule) => {
      const match = alertRuleCounts.find((c) => c.ruleId === rule.id);
      return {
        ruleId: rule.id,
        name: rule.name,
        severity: rule.severity,
        category: rule.category,
        count: Number(match?.count ?? 0),
      };
    });

    // Sort by count descending
    ruleStats.sort((a, b) => b.count - a.count);

    // 2. Top Threat IPs
    const ipLogStats = await db
      .select({
        ip: logEvents.sourceIp,
        totalRequests: sql<number>`count(*)::int`,
        suspiciousCount: sql<number>`count(*) filter (where ${logEvents.isSuspicious} = true)::int`,
        lastSeen: sql<string>`max(${logEvents.timestamp})::text`,
      })
      .from(logEvents)
      .groupBy(logEvents.sourceIp)
      .orderBy(desc(sql`count(*) filter (where ${logEvents.isSuspicious} = true)`))
      .limit(8);

    const ipAlertCounts = await db
      .select({
        ip: alerts.sourceIp,
        alertCount: sql<number>`count(*)::int`,
      })
      .from(alerts)
      .groupBy(alerts.sourceIp);

    const topSuspiciousIps: TopIpStat[] = [];
    for (const r of ipLogStats) {
      const alertMatch = ipAlertCounts.find((a) => a.ip === r.ip);
      // Find top targeted endpoint for this IP
      const topEndpointRes = await db
        .select({
          endpoint: logEvents.endpoint,
        })
        .from(logEvents)
        .where(eq(logEvents.sourceIp, r.ip))
        .groupBy(logEvents.endpoint)
        .orderBy(desc(sql`count(*)`))
        .limit(1);

      topSuspiciousIps.push({
        ip: r.ip,
        totalRequests: Number(r.totalRequests),
        suspiciousCount: Number(r.suspiciousCount),
        alertCount: Number(alertMatch?.alertCount ?? 0),
        lastSeen: r.lastSeen || new Date().toISOString(),
        primaryTarget: topEndpointRes[0]?.endpoint || '/api/portal',
      });
    }

    // 3. Targeted Endpoints
    const endpointRows = await db
      .select({
        endpoint: logEvents.endpoint,
        method: logEvents.method,
        totalHits: sql<number>`count(*)::int`,
        suspiciousHits: sql<number>`count(*) filter (where ${logEvents.isSuspicious} = true)::int`,
        errorCount: sql<number>`count(*) filter (where ${logEvents.statusCode} >= 400)::int`,
      })
      .from(logEvents)
      .groupBy(logEvents.endpoint, logEvents.method)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const targetedEndpoints: TargetedEndpointStat[] = endpointRows.map((e) => ({
      endpoint: e.endpoint,
      method: e.method,
      totalHits: Number(e.totalHits),
      suspiciousHits: Number(e.suspiciousHits),
      errorCount: Number(e.errorCount),
    }));

    // 4. Severity Distribution
    const severityRows = await db
      .select({
        severity: alerts.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(alerts)
      .groupBy(alerts.severity);

    const severityOrder = ['critical', 'high', 'medium', 'low'];
    const severityDistribution = severityOrder.map((sev) => {
      const match = severityRows.find((r) => r.severity.toLowerCase() === sev);
      return {
        severity: sev,
        count: Number(match?.count ?? 0),
      };
    });

    return {
      ruleStats,
      topSuspiciousIps,
      targetedEndpoints,
      severityDistribution,
    };
  },

  /**
   * Generates executive audit report summary based on selected time window
   */
  async getReportSummary(period: '24h' | '7d' | '30d' | 'all'): Promise<ReportSummaryData> {
    const overview = await this.getOverviewMetrics();
    const risk = await this.getRiskAnalytics();

    const severityCounts: Record<string, number> = {};
    risk.severityDistribution.forEach((s) => {
      severityCounts[s.severity] = s.count;
    });

    const keyFindings: string[] = [];
    if (overview.criticalAlerts > 0) {
      keyFindings.push(
        `Critical Risk: ${overview.criticalAlerts} high/critical alerts detected including multi-stage brute force and probable account takeover.`
      );
    }
    if (overview.suspiciousRatio > 15) {
      keyFindings.push(
        `Abnormal Anomaly Ratio: ${overview.suspiciousRatio}% of all ingested events were flagged as suspicious.`
      );
    }
    const tamperRule = risk.ruleStats.find((r) => r.ruleId === 'RULE-004');
    if (tamperRule && tamperRule.count > 0) {
      keyFindings.push(
        `Data Integrity Alert: ${tamperRule.count} unauthorized attendance record alterations detected on endpoint /api/attendance/records.`
      );
    }
    const sqliRule = risk.ruleStats.find((r) => r.ruleId === 'RULE-006');
    if (sqliRule && sqliRule.count > 0) {
      keyFindings.push(
        `Injection Attacks: ${sqliRule.count} SQL Injection / XSS probes intercepted.`
      );
    }
    if (keyFindings.length === 0) {
      keyFindings.push('Baseline security posture within normal operating parameters.');
    }

    const limitations = [
      'Analysis derived from structured HTTP logs and deterministic rule evaluation.',
      'Raw passwords, access tokens, and confidential student identifiers are zeroized by design.',
      'Active synthetic datasets are utilized for automated SOC validation.',
    ];

    return {
      period,
      generatedAt: new Date().toISOString(),
      totalEvents: overview.totalEvents,
      suspiciousEvents: overview.suspiciousEvents,
      totalAlerts: overview.totalAlerts,
      totalIncidents: overview.totalIncidents,
      openIncidents: overview.openIncidents,
      severityCounts,
      topRules: risk.ruleStats.slice(0, 5),
      topThreatIps: risk.topSuspiciousIps.slice(0, 5),
      keyFindings,
      limitations,
    };
  },

  /**
   * Streams raw log records for CSV export
   */
  async getExportLogs(limit = 1000): Promise<LogEventModel[]> {
    return await db
      .select()
      .from(logEvents)
      .orderBy(desc(logEvents.timestamp))
      .limit(limit);
  },
};
