import { DetectionRuleEvaluator, RuleEvaluationContext, AlertCandidate } from './baseRule.js';

const SCANNER_PROBE_PATTERNS = [
  '.env',
  'wp-login',
  'wp-admin',
  'config.json',
  'phpmyadmin',
  'actuator',
  '.git',
  'setup.php',
  'shell.php',
  'backup.sql',
];

export const rule005RouteFlooding: DetectionRuleEvaluator = {
  id: 'RULE-005',
  name: 'Request Flooding & Route Probing',
  category: 'reconnaissance',
  defaultSeverity: 'medium',

  async evaluate(context: RuleEvaluationContext): Promise<AlertCandidate[]> {
    const candidates: AlertCandidate[] = [];

    // Filter 404 probe events, scanner targets, or 429 rate limits
    const probeEvents = context.events.filter((e) => {
      if (e.statusCode === 429 || e.eventType === 'rate_limit_exceeded') return true;
      if (e.statusCode === 404 || e.eventType === 'not_found_probe') {
        const lowerEp = e.endpoint.toLowerCase();
        return SCANNER_PROBE_PATTERNS.some((p) => lowerEp.includes(p));
      }
      return false;
    });

    // Group by source IP
    const ipGroups = new Map<string, typeof probeEvents>();
    for (const evt of probeEvents) {
      const list = ipGroups.get(evt.sourceIp) || [];
      list.push(evt);
      ipGroups.set(evt.sourceIp, list);
    }

    for (const [sourceIp, events] of ipGroups.entries()) {
      if (events.length === 0) continue;

      const endpoints = Array.from(new Set(events.map((e) => e.endpoint)));
      const hasRateLimit = events.some((e) => e.statusCode === 429);
      const latest = events[events.length - 1];

      const severity = hasRateLimit || events.length >= 4 ? 'high' : 'medium';

      candidates.push({
        ruleId: 'RULE-005',
        title: `Automated Reconnaissance & Route Probing from ${sourceIp}`,
        description: `Source IP ${sourceIp} issued ${events.length} reconnaissance requests probing non-existent scanner paths (${endpoints.slice(0, 3).join(', ')})${hasRateLimit ? ' and tripped HTTP 429 Rate Limiter' : ''}.`,
        severity,
        sourceIp,
        actorId: events.find((e) => e.actorId)?.actorId || null,
        evidenceStrength: 'high',
        evidenceSummary: `Detected enumeration targeting ${endpoints.length} sensitive patterns: ${endpoints.join(', ')}. Tripped status codes: ${Array.from(new Set(events.map((e) => e.statusCode))).join(', ')}.`,
        supportingEventIds: events.map((e) => e.id),
        detectedAt: latest.timestamp,
      });
    }

    return candidates;
  },
};
