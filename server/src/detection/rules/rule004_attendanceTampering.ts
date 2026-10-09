import { DetectionRuleEvaluator, RuleEvaluationContext, AlertCandidate } from './baseRule.js';

export const rule004AttendanceTampering: DetectionRuleEvaluator = {
  id: 'RULE-004',
  name: 'Unusual Attendance Modifications',
  category: 'behavioral',
  defaultSeverity: 'high',

  async evaluate(context: RuleEvaluationContext): Promise<AlertCandidate[]> {
    const candidates: AlertCandidate[] = [];

    // Filter attendance modification events or bulk modifications
    const modificationEvents = context.events.filter(
      (e) =>
        e.eventType === 'attendance_modify' ||
        (e.endpoint.includes('/attendance') && (e.method === 'PUT' || e.method === 'PATCH' || e.method === 'DELETE'))
    );

    // Group by actor or source IP
    const groups = new Map<string, typeof modificationEvents>();
    for (const evt of modificationEvents) {
      const key = evt.actorId || evt.sourceIp;
      const list = groups.get(key) || [];
      list.push(evt);
      groups.set(key, list);
    }

    for (const [key, events] of groups.entries()) {
      if (events.length === 0) continue;

      const first = events[0];
      const latest = events[events.length - 1];
      const sourceIp = first.sourceIp;
      const actorId = first.actorId;

      candidates.push({
        ruleId: 'RULE-004',
        title: `Anomalous Attendance Modifications Detected by ${actorId || key}`,
        description: `Detected ${events.length} attendance modification transactions across student records outside normal class verification schedules.`,
        severity: 'high',
        sourceIp,
        actorId,
        evidenceStrength: 'high',
        evidenceSummary: `Actor ${actorId || 'unknown'} performed ${events.length} modification calls against endpoint '${first.endpoint}' between ${first.timestamp} and ${latest.timestamp}.`,
        supportingEventIds: events.map((e) => e.id),
        detectedAt: latest.timestamp,
      });
    }

    return candidates;
  },
};
