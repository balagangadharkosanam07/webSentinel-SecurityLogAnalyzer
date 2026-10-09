import { LogEventModel } from '../../db/schema/index.js';

export interface AlertCandidate {
  ruleId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  sourceIp: string;
  actorId: string | null;
  evidenceStrength: 'high' | 'medium' | 'low';
  evidenceSummary: string;
  supportingEventIds: string[];
  detectedAt: string;
}

export interface RuleEvaluationContext {
  events: LogEventModel[];
  config?: Record<string, unknown>;
}

export interface DetectionRuleEvaluator {
  id: string;
  name: string;
  category: string;
  defaultSeverity: 'critical' | 'high' | 'medium' | 'low';
  evaluate(context: RuleEvaluationContext): Promise<AlertCandidate[]>;
}
