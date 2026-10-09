export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlertStatus = 'open' | 'investigating' | 'resolved' | 'false_positive';

export interface Alert {
  id: string;
  rule_id: string;
  rule_name: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  detected_at: string;
  source_ip: string;
  actor_id?: string | null;
  actor_role?: string | null;
  evidence_strength: 'strong' | 'moderate' | 'weak';
  evidence_summary: string;
  supporting_event_ids: string[];
  incident_id?: string | null;
  is_synthetic: boolean;
}

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  category: 'authentication' | 'access_control' | 'behavioral' | 'reconnaissance' | 'injection';
  severity: AlertSeverity;
  enabled: boolean;
  threshold_description: string;
  time_window: string;
}
