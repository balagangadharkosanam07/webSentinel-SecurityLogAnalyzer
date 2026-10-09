import { AlertSeverity } from './alerts';

export type IncidentStatus = 'open' | 'investigating' | 'mitigated' | 'resolved' | 'closed';

export interface IncidentTimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  source_ip: string;
  actor_id?: string | null;
  actor_role?: string | null;
  severity: AlertSeverity;
  event_type: string;
}

export interface RiskScoreBreakdown {
  base_score: number;
  frequency_multiplier: number;
  criticality_weight: number;
  unauthorized_factor: number;
  total_score: number; // 0 - 100
  rationale: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: IncidentStatus;
  first_seen: string;
  last_seen: string;
  created_at: string;
  updated_at: string;
  primary_source_ip: string;
  targeted_asset: string;
  related_alert_ids: string[];
  supporting_event_ids: string[];
  risk_score: RiskScoreBreakdown;
  timeline: IncidentTimelineEvent[];
  is_synthetic: boolean;
}
