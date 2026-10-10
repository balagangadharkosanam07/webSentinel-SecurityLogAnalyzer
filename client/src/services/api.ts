/**
 * WebSentinel Backend API Client
 * Interfaces with Express REST API endpoints on /api/*
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown> & {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    count?: number;
    batch_id?: string;
    eventsEvaluated?: number;
    candidatesFound?: number;
    newAlertsCreated?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface IngestionBatchResult {
  batchId: string;
  sourceApp?: string;
  totalRecords: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  status: 'completed' | 'partial' | 'failed';
  rejectedItems?: Array<{ index: number; errors: string[]; sample?: unknown }>;
  insertedEvents?: DbLogEvent[];
}

export interface IngestionBatchRecord {
  id: string;
  source: string;
  receivedAt: string;
  totalRecords: number;
  acceptedCount: number;
  rejectedCount: number;
  status: 'completed' | 'partial' | 'failed';
  errorSummary: Record<string, unknown> | null;
}

export interface DbLogEvent {
  id: string;
  timestamp: string;
  ingestedAt: string;
  eventType: string;
  sourceIp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  actorId: string | null;
  actorRole: string | null;
  requestId: string;
  sourceApp: string;
  message: string;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  dedupId: string;
  isSuspicious: boolean;
  isSynthetic: boolean;
}

export interface DbAlert {
  id: string;
  ruleId: string;
  incidentId: string | null;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  sourceIp: string;
  actorId: string | null;
  evidenceStrength: 'high' | 'medium' | 'low';
  evidenceSummary: string;
  supportingEventIds: string[];
  detectedAt: string;
  isSynthetic: boolean;
  supportingEvents?: DbLogEvent[];
}

export interface LogFilterParams {
  search?: string;
  event_type?: string;
  source_ip?: string;
  status_code?: number | string;
  only_suspicious?: boolean;
  start_date?: string;
  end_date?: string;
  sort_by?: 'timestamp' | 'statusCode';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  offset?: number;
}

export interface AlertFilterParams {
  severity?: string;
  status?: string;
  rule_id?: string;
  source_ip?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface LogMetadataResult {
  eventTypes: string[];
  sourceIps: string[];
  totalCount: number;
}

export interface SeedAllResponse {
  message: string;
  totalLogsInDatabase: number;
  batches: Array<{
    file: string;
    source: string;
    total: number;
    accepted: number;
    duplicates: number;
    rejected: number;
    status: string;
    batchId?: string;
    error?: string;
  }>;
}

export interface DetectionRunResult {
  totalEventsEvaluated: number;
  rulesExecuted: number;
  candidatesFound: number;
  newAlertsCreated: number;
  alerts: DbAlert[];
}

export interface DetectionRuleInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  configuration: Record<string, unknown>;
  enabled: boolean;
  version: number;
}

export interface DbRiskBreakdown {
  base_score: number;
  frequency_multiplier: number;
  criticality_weight: number;
  unauthorized_factor: number;
  total_score: number;
  rationale: string;
}

export interface DbTimelineStep {
  id: string;
  timestamp: string;
  phase:
    | 'Reconnaissance'
    | 'Credential Access'
    | 'Initial Access'
    | 'Privilege Escalation'
    | 'Execution'
    | 'Impact';
  method: string;
  endpoint: string;
  statusCode: number;
  sourceIp: string;
  actorId: string | null;
  message: string;
}

export interface DbIncident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'investigating' | 'mitigated' | 'resolved' | 'closed';
  primarySourceIp: string;
  targetedAsset: string;
  riskScore: number;
  riskBreakdown: DbRiskBreakdown;
  firstSeen: string;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
  isSynthetic: boolean;
}

export interface DbIncidentWithDetails extends DbIncident {
  alerts: DbAlert[];
  timeline: DbTimelineStep[];
}

export interface IncidentFilterParams {
  severity?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IncidentCorrelateResult {
  totalAlertsProcessed: number;
  incidentsCreated: number;
  alertsLinked: number;
  incidents: DbIncident[];
}

function getApiBase(): string {
  const envBase = ((import.meta as any).env?.VITE_API_URL || '').trim();
  return envBase.replace(/\/$/, '');
}

export const API_BASE = getApiBase();

export const ATTENDANCE_PORTAL_URL =
  (import.meta as any).env?.VITE_PORTAL_URL || 'http://localhost:3001';

async function parseResponseJson<T>(res: Response, endpoint: string): Promise<ApiResponse<T>> {
  const text = await res.text();
  let json: ApiResponse<T>;
  try {
    json = JSON.parse(text);
  } catch {
    if (text.includes('<!doctype html>') || text.includes('<html')) {
      throw new Error(
        `WebSentinel API at '${endpoint}' returned an HTML page (Status ${res.status}). The backend service may still be waking up from sleep; please wait 30 seconds and refresh.`
      );
    }
    throw new Error(`Server returned unexpected non-JSON response from ${endpoint} (Status ${res.status}): ${text.slice(0, 100)}`);
  }
  return json;
}

const fetchApi = async (url: string, init?: RequestInit): Promise<Response> => {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  try {
    return await fetch(fullUrl, init);
  } catch {
    throw new Error(
      `Failed to connect to WebSentinel API at ${fullUrl}. Please check your connection or wait 30 seconds if the free server is waking up.`
    );
  }
};

export const api = {
  /**
   * Dispatches a batch of log records to the backend ingestion pipeline (Stages 1-7)
   */
  async importLogs(logs: unknown[], source = 'synthetic-dashboard-import'): Promise<ApiResponse<IngestionBatchResult>> {
    const res = await fetchApi('/api/logs/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WebSentinel-Key': 'dev-sample-ingestion-key-change-in-prod',
        'X-WebSentinel-Internal': 'true',
      },
      body: JSON.stringify({
        source,
        logs,
      }),
    });

    const json = await parseResponseJson<IngestionBatchResult>(res, '/api/logs/import');
    if (!res.ok && !json.data) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to import logs`);
    }
    return json;
  },

  /**
   * Triggers the server to ingest all 5 synthetic attack datasets into Neon DB
   */
  async seedAllDatasets(): Promise<ApiResponse<SeedAllResponse>> {
    const res = await fetchApi('/api/logs/seed-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await parseResponseJson<SeedAllResponse>(res, '/api/logs/seed-all');
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to seed datasets`);
    }
    return json;
  },

  /**
   * Retrieves recent audit records of ingestion batches from Neon PostgreSQL
   */
  async getBatches(limit = 10): Promise<ApiResponse<IngestionBatchRecord[]>> {
    const res = await fetchApi(`/api/logs/batches?limit=${limit}`);
    const json = await parseResponseJson<IngestionBatchRecord[]>(res, '/api/logs/batches');
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch batches`);
    }
    return json;
  },

  /**
   * Queries stored log events from Neon PostgreSQL with server-side filters & pagination
   */
  async getLogs(params: LogFilterParams = {}): Promise<ApiResponse<DbLogEvent[]>> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.event_type && params.event_type !== 'all') query.set('event_type', params.event_type);
    if (params.source_ip && params.source_ip !== 'all') query.set('source_ip', params.source_ip);
    if (params.status_code && params.status_code !== 'all') query.set('status_code', String(params.status_code));
    if (params.only_suspicious) query.set('only_suspicious', 'true');
    if (params.start_date) query.set('start_date', params.start_date);
    if (params.end_date) query.set('end_date', params.end_date);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.sort_order) query.set('sort_order', params.sort_order);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const res = await fetchApi(`/api/logs?${query.toString()}`);
    const json = await parseResponseJson<DbLogEvent[]>(res, '/api/logs');
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch logs`);
    }
    return json;
  },

  /**
   * Retrieves distinct filter options (IPs, event types, counts) directly from Neon DB
   */
  async getLogMetadata(): Promise<ApiResponse<LogMetadataResult>> {
    const res = await fetchApi('/api/logs/metadata');
    const json = await parseResponseJson<LogMetadataResult>(res, '/api/logs/metadata');
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch log metadata`);
    }
    return json;
  },

  /**
   * Executes the 6-rule Detection Engine against stored database logs
   */
  async runDetection(limit = 500): Promise<ApiResponse<DetectionRunResult>> {
    const res = await fetchApi('/api/detection/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit }),
    });
    const json = await parseResponseJson<DetectionRunResult>(res, '/api/detection/run');
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Detection engine execution failed`);
    }
    return json;
  },

  /**
   * Fetches persisted security alerts with filters and pagination
   */
  async getAlerts(params: AlertFilterParams = {}): Promise<ApiResponse<DbAlert[]>> {
    const query = new URLSearchParams();
    if (params.severity && params.severity !== 'all') query.set('severity', params.severity);
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.rule_id && params.rule_id !== 'all') query.set('rule_id', params.rule_id);
    if (params.source_ip && params.source_ip !== 'all') query.set('source_ip', params.source_ip);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const res = await fetchApi(`/api/alerts?${query.toString()}`);
    const json = await parseResponseJson<DbAlert[]>(res, '/api/alerts');
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch alerts`);
    }
    return json;
  },

  /**
   * Retrieves a single security alert with its hydrated supporting log events
   */
  async getAlertById(id: string): Promise<ApiResponse<DbAlert>> {
    const res = await fetchApi(`/api/alerts/${id}`);
    const json = await parseResponseJson<DbAlert>(res, `/api/alerts/${id}`);
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch alert details`);
    }
    return json;
  },

  /**
   * Updates an alert triage status (open, investigating, resolved, false_positive)
   */
  async updateAlertStatus(id: string, status: string): Promise<ApiResponse<DbAlert>> {
    const res = await fetchApi(`/api/alerts/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await parseResponseJson<DbAlert>(res, `/api/alerts/${id}/status`);
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to update alert status`);
    }
    return json;
  },

  /**
   * Retrieves registered detection rules
   */
  async getDetectionRules(): Promise<ApiResponse<DetectionRuleInfo[]>> {
    const res = await fetchApi('/api/detection/rules');
    const json = await parseResponseJson<DetectionRuleInfo[]>(res, '/api/detection/rules');
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch detection rules`);
    }
    return json;
  },

  /**
   * Health check endpoint
   */
  async checkHealth(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    const res = await fetchApi('/api/health');
    const json = await parseResponseJson<{ status: string; timestamp: string }>(res, '/api/health');
    return json;
  },

  /**
   * Triggers the Incident Correlation Engine to cluster alerts into multi-stage incidents
   */
  async correlateIncidents(): Promise<ApiResponse<IncidentCorrelateResult>> {
    const res = await fetchApi('/api/incidents/correlate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await parseResponseJson<IncidentCorrelateResult>(res, '/api/incidents/correlate');
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Incident correlation failed`);
    }
    return json;
  },

  /**
   * Fetches correlated security incidents with filtering and pagination
   */
  async getIncidents(params: IncidentFilterParams = {}): Promise<ApiResponse<DbIncident[]>> {
    const query = new URLSearchParams();
    if (params.severity && params.severity !== 'all') query.set('severity', params.severity);
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const res = await fetchApi(`/api/incidents?${query.toString()}`);
    const json = await parseResponseJson<DbIncident[]>(res, '/api/incidents');
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch incidents`);
    }
    return json;
  },

  /**
   * Fetches single incident with full details (hydrated alerts & chronological kill-chain timeline)
   */
  async getIncidentById(id: string): Promise<ApiResponse<DbIncidentWithDetails>> {
    const res = await fetchApi(`/api/incidents/${id}`);
    const json = await parseResponseJson<DbIncidentWithDetails>(res, `/api/incidents/${id}`);
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch incident details`);
    }
    return json;
  },

  /**
   * Updates an incident triage status (open, investigating, mitigated, resolved, closed)
   */
  async updateIncidentStatus(id: string, status: string): Promise<ApiResponse<DbIncident>> {
    const res = await fetchApi(`/api/incidents/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await parseResponseJson<DbIncident>(res, `/api/incidents/${id}/status`);
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to update incident status`);
    }
    return json;
  },

  /**
   * Retrieves high-level SOC overview metrics, trends, and recent telemetry
   */
  async getOverviewMetrics(): Promise<ApiResponse<OverviewMetricsData>> {
    const res = await fetchApi('/api/analytics/overview');
    const json = await parseResponseJson<OverviewMetricsData>(res, '/api/analytics/overview');
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch overview metrics`);
    }
    return json;
  },

  /**
   * Retrieves deep risk analytics (rule frequencies, top IPs, targeted endpoints)
   */
  async getRiskAnalytics(): Promise<ApiResponse<RiskAnalyticsResult>> {
    const res = await fetchApi('/api/analytics/risk');
    const json = await parseResponseJson<RiskAnalyticsResult>(res, '/api/analytics/risk');
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch risk analytics`);
    }
    return json;
  },

  /**
   * Retrieves security audit report summary for selected period
   */
  async getReportSummary(period = '24h'): Promise<ApiResponse<ReportSummaryResult>> {
    const res = await fetchApi(`/api/reports/summary?period=${period}`);
    const json = await parseResponseJson<ReportSummaryResult>(res, `/api/reports/summary?period=${period}`);
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch report summary`);
    }
    return json;
  },

  /**
   * Exports raw security logs to CSV format URL
   */
  getReportExportUrl(period = '24h'): string {
    return `${API_BASE}/api/reports/export?period=${period}`;
  },
};

export interface OverviewMetricsData {
  totalEvents: number;
  suspiciousEvents: number;
  suspiciousRatio: number;
  openIncidents: number;
  totalIncidents: number;
  criticalAlerts: number;
  totalAlerts: number;
  eventTrends: Array<{
    time: string;
    total: number;
    suspicious: number;
    normal: number;
  }>;
  severityDistribution: Array<{
    severity: string;
    count: number;
  }>;
  recentAlerts: DbAlert[];
  recentEvents: DbLogEvent[];
}

export interface RuleStatData {
  ruleId: string;
  name: string;
  severity: string;
  category: string;
  count: number;
}

export interface TopIpStatData {
  ip: string;
  totalRequests: number;
  suspiciousCount: number;
  alertCount: number;
  lastSeen: string;
  primaryTarget: string;
}

export interface TargetedEndpointData {
  endpoint: string;
  method: string;
  totalHits: number;
  suspiciousHits: number;
  errorCount: number;
}

export interface RiskAnalyticsResult {
  ruleStats: RuleStatData[];
  topSuspiciousIps: TopIpStatData[];
  targetedEndpoints: TargetedEndpointData[];
  severityDistribution: Array<{ severity: string; count: number }>;
}

export interface ReportSummaryResult {
  period: string;
  generatedAt: string;
  totalEvents: number;
  suspiciousEvents: number;
  totalAlerts: number;
  totalIncidents: number;
  openIncidents: number;
  severityCounts: Record<string, number>;
  topRules: RuleStatData[];
  topThreatIps: TopIpStatData[];
  keyFindings: string[];
  limitations: string[];
}

