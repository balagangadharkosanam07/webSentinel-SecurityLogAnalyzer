import crypto from 'crypto';
import { AlertModel, IncidentModel, NewIncident } from '../db/schema/index.js';
import { alertsRepository } from '../repositories/alerts.repository.js';
import { incidentsRepository } from '../repositories/incidents.repository.js';
import { logger } from '../utils/logger.js';

export interface RiskBreakdown {
  base_score: number;
  frequency_multiplier: number;
  criticality_weight: number;
  unauthorized_factor: number;
  total_score: number;
  rationale: string;
}

export interface CorrelationResult {
  totalAlertsProcessed: number;
  incidentsCreated: number;
  alertsLinked: number;
  incidents: IncidentModel[];
}

export function computeExplainableRiskScore(alertCluster: AlertModel[]): RiskBreakdown {
  if (alertCluster.length === 0) {
    return {
      base_score: 0,
      frequency_multiplier: 0,
      criticality_weight: 0,
      unauthorized_factor: 0,
      total_score: 0,
      rationale: 'No alerts in cluster',
    };
  }

  // 1. Base Severity Score
  let base_score = 10;
  const severities = alertCluster.map((a) => a.severity.toLowerCase());
  let highestSeverity = 'low';

  if (severities.includes('critical')) {
    base_score = 50;
    highestSeverity = 'critical';
  } else if (severities.includes('high')) {
    base_score = 35;
    highestSeverity = 'high';
  } else if (severities.includes('medium')) {
    base_score = 20;
    highestSeverity = 'medium';
  }

  // 2. Frequency & Volume Multiplier
  const frequency_multiplier = Math.min(20, (alertCluster.length - 1) * 5);

  // 3. Asset & Privileged Role Criticality Weight
  let criticality_weight = 0;
  let assetContext = 'standard user route';

  const actors = alertCluster.map((a) => (a.actorId || '').toLowerCase());
  const ruleIds = alertCluster.map((a) => a.ruleId);

  if (actors.some((act) => act.includes('adm') || act.includes('admin') || act.includes('root'))) {
    criticality_weight = 25;
    assetContext = 'Administrator Account / System Configuration';
  } else if (actors.some((act) => act.includes('tch') || act.includes('teacher') || act.includes('staff'))) {
    criticality_weight = 15;
    assetContext = 'Instructor Account / Grading Authority';
  } else if (ruleIds.includes('RULE-003')) {
    criticality_weight = 10;
    assetContext = 'Restricted Administrative Endpoint (/api/admin)';
  }

  // 4. Active Breach / High Impact Factor
  let unauthorized_factor = 0;
  if (ruleIds.includes('RULE-002')) {
    unauthorized_factor += 15; // Probable Account Takeover verified
  }
  if (ruleIds.includes('RULE-004')) {
    unauthorized_factor += 10; // Active Database Attendance Tampering
  }
  unauthorized_factor = Math.min(20, unauthorized_factor);

  // 5. Total Score bounded strictly between 0 and 100
  const total_score = Math.min(
    100,
    base_score + frequency_multiplier + criticality_weight + unauthorized_factor
  );

  const rationale = `Base score ${base_score} (${highestSeverity.toUpperCase()} rule) + ${frequency_multiplier} (${alertCluster.length} correlated alerts) + ${criticality_weight} (${assetContext}) + ${unauthorized_factor} (active breach indicator). Total Risk Score: ${total_score}/100.`;

  return {
    base_score,
    frequency_multiplier,
    criticality_weight,
    unauthorized_factor,
    total_score,
    rationale,
  };
}

export class CorrelationService {
  /**
   * Correlates security alerts by attacker IP / actor and calculates explainable risk scores
   */
  async correlateAlerts(): Promise<CorrelationResult> {
    const allAlerts = await alertsRepository.findMany({ limit: 500 });

    if (allAlerts.length === 0) {
      return {
        totalAlertsProcessed: 0,
        incidentsCreated: 0,
        alertsLinked: 0,
        incidents: [],
      };
    }

    // Group alerts by source IP (primary attack vector)
    const ipClusters = new Map<string, AlertModel[]>();
    for (const alert of allAlerts) {
      const list = ipClusters.get(alert.sourceIp) || [];
      list.push(alert);
      ipClusters.set(alert.sourceIp, list);
    }

    const createdIncidents: IncidentModel[] = [];
    let alertsLinked = 0;

    for (const [sourceIp, cluster] of ipClusters.entries()) {
      if (cluster.length === 0) continue;

      // Sort cluster chronologically
      cluster.sort(
        (a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()
      );

      const firstSeen = cluster[0].detectedAt;
      const lastSeen = cluster[cluster.length - 1].detectedAt;

      // Calculate explainable risk score
      const risk = computeExplainableRiskScore(cluster);

      // Determine overall incident severity
      const severities = cluster.map((a) => a.severity.toLowerCase());
      let overallSeverity = 'low';
      if (severities.includes('critical')) overallSeverity = 'critical';
      else if (severities.includes('high')) overallSeverity = 'high';
      else if (severities.includes('medium')) overallSeverity = 'medium';

      // Determine targeted asset context
      const actors = cluster.map((a) => a.actorId).filter(Boolean);
      const primaryActor = actors[0] || null;
      let targetedAsset = `/api/portal (${sourceIp})`;

      if (cluster.some((a) => a.ruleId === 'RULE-002')) {
        targetedAsset = `/api/auth/login (Compromised: ${primaryActor || 'Admin'})`;
      } else if (cluster.some((a) => a.ruleId === 'RULE-004')) {
        targetedAsset = `/api/attendance/records (Bulk Alteration)`;
      } else if (cluster.some((a) => a.ruleId === 'RULE-006')) {
        targetedAsset = `/api/search (SQLi / XSS Attack Vector)`;
      } else if (cluster.some((a) => a.ruleId === 'RULE-003')) {
        targetedAsset = `/api/admin/audit (Privileged Endpoint)`;
      }

      // Title & Description
      const ruleNames = Array.from(new Set(cluster.map((a) => a.ruleId))).join(', ');
      const title =
        overallSeverity === 'critical'
          ? `Critical Attack Campaign: Multi-stage Exploitation from ${sourceIp}`
          : overallSeverity === 'high'
          ? `High-Risk Intrusion Activity: Correlated ${cluster.length} Alerts from ${sourceIp}`
          : `Suspicious Security Anomalies from ${sourceIp}`;

      const description = `Correlated ${cluster.length} alerts (${ruleNames}) detected between ${firstSeen} and ${lastSeen}. Risk score evaluated at ${risk.total_score}/100.`;

      // Deterministic Incident ID
      const rawClusterKey = `${sourceIp}|${cluster.map((a) => a.id).sort().join(',')}`;
      const hash = crypto.createHash('md5').update(rawClusterKey).digest('hex');
      const incidentId = `INC-2026-${hash.slice(0, 8).toUpperCase()}`;

      const incidentData: NewIncident = {
        id: incidentId,
        title,
        description,
        severity: overallSeverity,
        status: 'open',
        primarySourceIp: sourceIp,
        targetedAsset,
        riskScore: risk.total_score,
        riskBreakdown: risk,
        firstSeen,
        lastSeen,
        isSynthetic: true,
      };

      const savedIncident = await incidentsRepository.upsert(incidentData);

      if (savedIncident) {
        createdIncidents.push(savedIncident);
        const alertIds = cluster.map((a) => a.id);
        await incidentsRepository.linkAlertsToIncident(savedIncident.id, alertIds);
        alertsLinked += alertIds.length;
      }
    }

    logger.info(
      `Correlation Engine Run: Processed ${allAlerts.length} alerts into ${createdIncidents.length} security incidents (linked ${alertsLinked} alerts).`
    );

    return {
      totalAlertsProcessed: allAlerts.length,
      incidentsCreated: createdIncidents.length,
      alertsLinked,
      incidents: createdIncidents,
    };
  }
}

export const correlationService = new CorrelationService();
