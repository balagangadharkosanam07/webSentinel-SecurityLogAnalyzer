import { DetectionRuleEvaluator, RuleEvaluationContext, AlertCandidate } from './baseRule.js';

export const rule003UnauthorizedProbes: DetectionRuleEvaluator = {
  id: 'RULE-003',
  name: 'Unauthorized Access Attempt',
  category: 'access_control',
  defaultSeverity: 'medium',

  async evaluate(context: RuleEvaluationContext): Promise<AlertCandidate[]> {
    const candidates: AlertCandidate[] = [];

    // Filter 403 forbidden or access_denied / permission_denied events
    const unauthorizedEvents = context.events.filter(
      (e) => e.statusCode === 403 || e.eventType === 'permission_denied' || e.eventType === 'access_denied'
    );

    // Group by source IP
    const ipGroups = new Map<string, typeof unauthorizedEvents>();
    for (const evt of unauthorizedEvents) {
      const list = ipGroups.get(evt.sourceIp) || [];
      list.push(evt);
      ipGroups.set(evt.sourceIp, list);
    }

    for (const [sourceIp, events] of ipGroups.entries()) {
      if (events.length === 0) continue;

      const endpoints = Array.from(new Set(events.map((e) => e.endpoint)));
      const actor = events.find((e) => e.actorId)?.actorId || null;
      const latest = events[events.length - 1];

      const severity = events.length >= 3 ? 'high' : 'medium';

      candidates.push({
        ruleId: 'RULE-003',
        title: `Unauthorized Privilege Access Probes from ${sourceIp}`,
        description: `Source IP ${sourceIp} received ${events.length} HTTP 403 Forbidden rejections targeting restricted administrative routes (${endpoints.slice(0, 3).join(', ')}).`,
        severity,
        sourceIp,
        actorId: actor,
        evidenceStrength: events.length >= 3 ? 'high' : 'medium',
        evidenceSummary: `Actor '${actor || 'anonymous'}' from IP ${sourceIp} probed protected routes without adequate authorization tokens: ${endpoints.join('; ')}.`,
        supportingEventIds: events.map((e) => e.id),
        detectedAt: latest.timestamp,
      });
    }

    return candidates;
  },
};
