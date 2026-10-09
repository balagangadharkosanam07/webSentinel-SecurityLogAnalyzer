import crypto from 'crypto';
import { LogEventModel, AlertModel, NewAlert } from '../db/schema/index.js';
import { DetectionRuleEvaluator, AlertCandidate } from './rules/baseRule.js';
import { rule001BruteForce } from './rules/rule001_bruteForce.js';
import { rule002SuspiciousLoginSeq } from './rules/rule002_suspiciousLoginSeq.js';
import { rule003UnauthorizedProbes } from './rules/rule003_unauthorizedProbes.js';
import { rule004AttendanceTampering } from './rules/rule004_attendanceTampering.js';
import { rule005RouteFlooding } from './rules/rule005_routeFlooding.js';
import { rule006InjectionIndicators } from './rules/rule006_injectionIndicators.js';
import { detectionRulesRepository } from '../repositories/detectionRules.repository.js';
import { alertsRepository } from '../repositories/alerts.repository.js';
import { logEventsRepository } from '../repositories/logEvents.repository.js';
import { logger } from '../utils/logger.js';

export interface DetectionRunOptions {
  events?: LogEventModel[];
  limit?: number;
}

export interface DetectionRunResult {
  totalEventsEvaluated: number;
  rulesExecuted: number;
  candidatesFound: number;
  newAlertsCreated: number;
  alerts: AlertModel[];
}

export class DetectionEngine {
  private rules: Map<string, DetectionRuleEvaluator> = new Map();

  constructor() {
    this.registerRule(rule001BruteForce);
    this.registerRule(rule002SuspiciousLoginSeq);
    this.registerRule(rule003UnauthorizedProbes);
    this.registerRule(rule004AttendanceTampering);
    this.registerRule(rule005RouteFlooding);
    this.registerRule(rule006InjectionIndicators);
  }

  registerRule(rule: DetectionRuleEvaluator) {
    this.rules.set(rule.id, rule);
  }

  getRegisteredRules(): DetectionRuleEvaluator[] {
    return Array.from(this.rules.values());
  }

  /**
   * Evaluates active rules against the log event stream and generates persisted security alerts
   */
  async run(options: DetectionRunOptions = {}): Promise<DetectionRunResult> {
    // 1. Fetch telemetry events
    const events =
      options.events ||
      (await logEventsRepository.findMany({
        limit: options.limit || 500,
        sortBy: 'timestamp',
        sortOrder: 'desc',
      }));

    if (events.length === 0) {
      return {
        totalEventsEvaluated: 0,
        rulesExecuted: 0,
        candidatesFound: 0,
        newAlertsCreated: 0,
        alerts: [],
      };
    }

    // 2. Fetch enabled rules and configuration from PostgreSQL
    let dbRules = await detectionRulesRepository.findEnabled();
    const configMap = new Map<string, Record<string, unknown>>();
    const enabledSet = new Set<string>();

    if (dbRules.length > 0) {
      dbRules.forEach((r) => {
        enabledSet.add(r.id);
        configMap.set(r.id, (r.configuration as Record<string, unknown>) || {});
      });
    } else {
      // Default to enabling all registered rules if DB table is unpopulated
      this.rules.forEach((_, id) => enabledSet.add(id));
    }

    const evaluatorsToRun = Array.from(this.rules.values()).filter((r) =>
      enabledSet.has(r.id)
    );

    // 3. Concurrently evaluate each rule
    const candidateResults = await Promise.all(
      evaluatorsToRun.map(async (evaluator) => {
        try {
          const config = configMap.get(evaluator.id) || {};
          return await evaluator.evaluate({ events, config });
        } catch (err: any) {
          logger.error(`Error evaluating detection rule ${evaluator.id}:`, err);
          return [];
        }
      })
    );

    const candidates: AlertCandidate[] = candidateResults.flat();

    // 4. Construct idempotent NewAlert models
    const newAlerts: NewAlert[] = candidates.map((cand) => {
      // Deterministic 32-character ID based on rule, attacker IP, and event IDs
      const rawKey = `${cand.ruleId}|${cand.sourceIp}|${[...cand.supportingEventIds].sort().join(',')}`;
      const hash = crypto.createHash('md5').update(rawKey).digest('hex');
      const alertId = `ALT-${hash.slice(0, 28)}`;

      return {
        id: alertId,
        ruleId: cand.ruleId,
        title: cand.title,
        description: cand.description,
        severity: cand.severity,
        status: 'open',
        sourceIp: cand.sourceIp,
        actorId: cand.actorId,
        evidenceStrength: cand.evidenceStrength,
        evidenceSummary: cand.evidenceSummary,
        supportingEventIds: cand.supportingEventIds,
        detectedAt: cand.detectedAt,
        isSynthetic: true,
      };
    });

    // 5. Persist to Neon PostgreSQL with ON CONFLICT DO NOTHING
    const createdAlerts = await alertsRepository.createMany(newAlerts);

    logger.info(
      `Detection Engine Run: Evaluated ${events.length} logs with ${evaluatorsToRun.length} rules -> Found ${candidates.length} candidates, Persisted ${createdAlerts.length} new alerts.`
    );

    return {
      totalEventsEvaluated: events.length,
      rulesExecuted: evaluatorsToRun.length,
      candidatesFound: candidates.length,
      newAlertsCreated: createdAlerts.length,
      alerts: createdAlerts,
    };
  }
}

export const detectionEngine = new DetectionEngine();
