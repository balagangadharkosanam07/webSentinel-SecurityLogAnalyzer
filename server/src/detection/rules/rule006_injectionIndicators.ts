import { DetectionRuleEvaluator, RuleEvaluationContext, AlertCandidate } from './baseRule.js';

const SQLI_PATTERNS = [
  /(\b(union\s+select|select\s+.*\s+from|insert\s+into|update\s+.*\s+set|delete\s+from|drop\s+table|sleep\s*\()\b)/i,
  /('|\%27)\s*or\s*('|\%27)?\d+('|\%27)?\s*=\s*('|\%27)?\d+/i,
  /(--|#|\/\*)/i,
];

const XSS_PATTERNS = [
  /<script\b[^>]*>/i,
  /<\/script>/i,
  /javascript:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /alert\s*\(/i,
];

export const rule006InjectionIndicators: DetectionRuleEvaluator = {
  id: 'RULE-006',
  name: 'Injection Indicators',
  category: 'injection',
  defaultSeverity: 'critical',

  async evaluate(context: RuleEvaluationContext): Promise<AlertCandidate[]> {
    const candidates: AlertCandidate[] = [];

    // Filter injection events
    const injectionEvents = context.events.filter((e) => {
      if (e.eventType === 'sql_injection_attempt' || e.eventType === 'xss_attempt') {
        return true;
      }

      const rawContent = `${e.endpoint} ${e.message} ${JSON.stringify(e.metadata || {})}`;
      const isSql = SQLI_PATTERNS.some((regex) => regex.test(rawContent));
      const isXss = XSS_PATTERNS.some((regex) => regex.test(rawContent));
      return isSql || isXss;
    });

    // Group by source IP
    const ipGroups = new Map<string, typeof injectionEvents>();
    for (const evt of injectionEvents) {
      const list = ipGroups.get(evt.sourceIp) || [];
      list.push(evt);
      ipGroups.set(evt.sourceIp, list);
    }

    for (const [sourceIp, events] of ipGroups.entries()) {
      if (events.length === 0) continue;

      const latest = events[events.length - 1];
      const hasSql = events.some(
        (e) =>
          e.eventType === 'sql_injection_attempt' ||
          SQLI_PATTERNS.some((r) => r.test(`${e.endpoint} ${e.message}`))
      );
      const attackType = hasSql ? 'SQL Injection (SQLi)' : 'Cross-Site Scripting (XSS)';

      candidates.push({
        ruleId: 'RULE-006',
        title: `Hostile ${attackType} Attack Detected from ${sourceIp}`,
        description: `Source IP ${sourceIp} delivered ${events.length} payload(s) containing hostile injection syntax aimed at exploiting application data execution contexts.`,
        severity: 'critical',
        sourceIp,
        actorId: events.find((e) => e.actorId)?.actorId || null,
        evidenceStrength: 'high',
        evidenceSummary: `Detected malicious payload patterns targeting endpoint '${latest.endpoint}': message preview="${latest.message.slice(0, 100)}".`,
        supportingEventIds: events.map((e) => e.id),
        detectedAt: latest.timestamp,
      });
    }

    return candidates;
  },
};
