export interface EventTrendPoint {
  time: string;
  total: number;
  suspicious: number;
  blocked: number;
}

export interface RuleDetectionStat {
  rule_id: string;
  rule_name: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  count: number;
  percentage: number;
}

export interface TopSuspiciousIp {
  ip: string;
  geo: string;
  event_count: number;
  failed_logins: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  last_activity: string;
  associated_incidents: number;
}

export interface TargetedEndpoint {
  endpoint: string;
  method: string;
  total_hits: number;
  status_401: number;
  status_403: number;
  status_404: number;
  status_500: number;
  risk_level: 'high' | 'medium' | 'low';
}
