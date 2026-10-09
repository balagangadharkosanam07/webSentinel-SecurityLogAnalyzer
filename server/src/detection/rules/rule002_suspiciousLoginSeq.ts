import { DetectionRuleEvaluator, RuleEvaluationContext, AlertCandidate } from './baseRule.js';

export const rule002SuspiciousLoginSeq: DetectionRuleEvaluator = {
  id: 'RULE-002',
  name: 'Suspicious Login Sequence',
  category: 'authentication',
  defaultSeverity: 'critical',

  async evaluate(context: RuleEvaluationContext): Promise<AlertCandidate[]> {
    const failureThreshold = (context.config?.failure_threshold as number) || 3;
    const successWindowSeconds = (context.config?.success_window_seconds as number) || 60;
    const candidates: AlertCandidate[] = [];

    // Filter all login events (both failures and successes)
    const loginEvents = context.events.filter(
      (e) =>
        e.eventType === 'login_failed' ||
        e.eventType === 'login_success' ||
        e.endpoint.includes('/login')
    );

    // Group by source IP
    const ipGroups = new Map<string, typeof loginEvents>();
    for (const evt of loginEvents) {
      const list = ipGroups.get(evt.sourceIp) || [];
      list.push(evt);
      ipGroups.set(evt.sourceIp, list);
    }

    for (const [sourceIp, events] of ipGroups.entries()) {
      // Sort chronologically ascending
      events.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      for (let i = 0; i < events.length; i++) {
        const current = events[i];

        // Check if current is a successful login
        if (current.eventType === 'login_success' || (current.statusCode === 200 && current.endpoint.includes('/login'))) {
          // Look backwards for consecutive failures within successWindowSeconds
          const priorFailures = [];
          for (let j = i - 1; j >= 0; j--) {
            const prev = events[j];
            const diffSeconds =
              (new Date(current.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;

            if (diffSeconds > successWindowSeconds) break;

            if (prev.eventType === 'login_failed' || prev.statusCode === 401) {
              priorFailures.unshift(prev);
            }
          }

          if (priorFailures.length >= failureThreshold) {
            const allSupporting = [...priorFailures, current];
            candidates.push({
              ruleId: 'RULE-002',
              title: `Probable Account Takeover: Rapid Login Success After ${priorFailures.length} Failures`,
              description: `Source IP ${sourceIp} encountered ${priorFailures.length} consecutive authentication failures before successfully logging in as actor '${current.actorId || 'unknown'}' within ${successWindowSeconds}s.`,
              severity: 'critical',
              sourceIp,
              actorId: current.actorId || null,
              evidenceStrength: 'high',
              evidenceSummary: `${priorFailures.length} failed login attempts at ${priorFailures[0].timestamp} culminated in successful authentication at ${current.timestamp} for role '${current.actorRole || 'user'}'.`,
              supportingEventIds: allSupporting.map((e) => e.id),
              detectedAt: current.timestamp,
            });
            break;
          }
        }
      }
    }

    return candidates;
  },
};
