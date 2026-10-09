import { DetectionRuleEvaluator, RuleEvaluationContext, AlertCandidate } from './baseRule.js';

export const rule001BruteForce: DetectionRuleEvaluator = {
  id: 'RULE-001',
  name: 'Repeated Failed Logins',
  category: 'authentication',
  defaultSeverity: 'high',

  async evaluate(context: RuleEvaluationContext): Promise<AlertCandidate[]> {
    const threshold = (context.config?.threshold as number) || 3;
    const windowSeconds = (context.config?.window_seconds as number) || 300;
    const candidates: AlertCandidate[] = [];

    // Filter relevant failed authentication events
    const failedLogins = context.events.filter(
      (e) =>
        e.eventType === 'login_failed' ||
        (e.endpoint.includes('/login') && e.statusCode === 401)
    );

    // Group by source IP
    const ipGroups = new Map<string, typeof failedLogins>();
    for (const evt of failedLogins) {
      const list = ipGroups.get(evt.sourceIp) || [];
      list.push(evt);
      ipGroups.set(evt.sourceIp, list);
    }

    // Evaluate each IP group against sliding window threshold
    for (const [sourceIp, events] of ipGroups.entries()) {
      if (events.length < threshold) continue;

      // Sort chronologically ascending
      events.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Sliding window check
      for (let i = 0; i <= events.length - threshold; i++) {
        const first = events[i];
        const last = events[i + threshold - 1];
        const spanSeconds =
          (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / 1000;

        if (spanSeconds <= windowSeconds) {
          const windowEvents = events.slice(i, i + threshold);
          candidates.push({
            ruleId: 'RULE-001',
            title: `Credential Brute Force Detected from ${sourceIp}`,
            description: `Observed ${threshold} failed authentication attempts within ${Math.round(spanSeconds)} seconds (threshold: ${threshold} in ${windowSeconds}s).`,
            severity: 'high',
            sourceIp,
            actorId: windowEvents.find((e) => e.actorId)?.actorId || null,
            evidenceStrength: 'high',
            evidenceSummary: `Source IP ${sourceIp} triggered ${windowEvents.length} consecutive HTTP 401 login rejections between ${first.timestamp} and ${last.timestamp}.`,
            supportingEventIds: windowEvents.map((e) => e.id),
            detectedAt: last.timestamp,
          });
          break; // One alert per IP cluster in this run
        }
      }
    }

    return candidates;
  },
};
