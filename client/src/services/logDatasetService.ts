import { LogEvent, LogRecordContractSchema } from '../types/logs';
import { SYNTHETIC_LOG_EVENTS } from '../data/mockData';

export type DatasetCategory =
  | 'all'
  | 'normal'
  | 'brute_force'
  | 'unauthorized'
  | 'attendance_tampering'
  | 'recon_injection'
  | 'malformed_suite';

export interface ValidationSummary {
  total: number;
  validCount: number;
  invalidCount: number;
  errors: Array<{ index: number; testCase?: string; error: string; sample: unknown }>;
  validEvents: LogEvent[];
}

// Sample dataset raw definitions
export const DATASET_META: Record<
  DatasetCategory,
  { name: string; description: string; ruleTarget?: string }
> = {
  all: {
    name: 'All Synthetic Telemetry',
    description: 'Master combined dataset with balanced benign and malicious telemetry',
  },
  normal: {
    name: 'Normal Portal Traffic',
    description: 'Routine attendance marking, successful logins, and expected user behavior',
    ruleTarget: 'Baseline / Non-alerting',
  },
  brute_force: {
    name: 'Credential Brute Force',
    description: 'Rapid failed logins followed by successful admin authentication & rate limiting',
    ruleTarget: 'Rule 1 & Rule 2',
  },
  unauthorized: {
    name: 'Unauthorized Access Probes',
    description: 'HTTP 403 authorization failures on privileged audit and admin endpoints',
    ruleTarget: 'Rule 3',
  },
  attendance_tampering: {
    name: 'Attendance Tampering',
    description: 'Bulk retroactive attendance alterations outside standard policy windows',
    ruleTarget: 'Rule 4',
  },
  recon_injection: {
    name: 'Reconnaissance & Injection',
    description: 'Scanner route enumeration (.env, wp-login) and SQLi / XSS patterns',
    ruleTarget: 'Rule 5 & Rule 6',
  },
  malformed_suite: {
    name: 'Malformed Logs Test Suite',
    description: 'Deliberately broken JSON records testing schema rejection and contract safety',
    ruleTarget: 'Ingestion Pipeline Validation',
  },
};

export const RAW_MALFORMED_RECORDS = [
  {
    _test_case: 'REJECT: Missing required timestamp field',
    event_type: 'login_failed',
    actor_id: null,
    actor_role: null,
    source_ip: '192.0.2.1',
    method: 'POST',
    endpoint: '/api/auth/login',
    status_code: 401,
    request_id: 'req-err-001',
    source_app: 'attendance-portal',
    message: 'Missing timestamp',
  },
  {
    _test_case: 'REJECT: Invalid event_type enumeration',
    timestamp: '2026-10-09T10:00:00Z',
    event_type: 'database_hacked_random_string',
    actor_id: null,
    actor_role: null,
    source_ip: '192.0.2.1',
    method: 'GET',
    endpoint: '/api/users',
    status_code: 200,
    request_id: 'req-err-002',
    source_app: 'attendance-portal',
    message: 'Invalid event type test',
  },
  {
    _test_case: 'REJECT: Invalid IP format',
    timestamp: '2026-10-09T10:00:00Z',
    event_type: 'login_failed',
    actor_id: null,
    actor_role: null,
    source_ip: 'not-a-valid-ip-address',
    method: 'POST',
    endpoint: '/api/auth/login',
    status_code: 401,
    request_id: 'req-err-003',
    source_app: 'attendance-portal',
    message: 'Invalid IP address',
  },
  {
    _test_case: 'REJECT: Out-of-bounds HTTP status code',
    timestamp: '2026-10-09T10:00:00Z',
    event_type: 'app_error',
    actor_id: null,
    actor_role: null,
    source_ip: '192.0.2.1',
    method: 'GET',
    endpoint: '/api/test',
    status_code: 9999,
    request_id: 'req-err-004',
    source_app: 'attendance-portal',
    message: 'Illegal status code',
  },
  {
    _test_case: 'REJECT: Violation of privacy contract (contains plain password)',
    timestamp: '2026-10-09T10:00:00Z',
    event_type: 'login_failed',
    actor_id: null,
    actor_role: null,
    source_ip: '192.0.2.1',
    method: 'POST',
    endpoint: '/api/auth/login',
    status_code: 401,
    request_id: 'req-err-005',
    source_app: 'attendance-portal',
    message: 'Authentication failed',
    metadata: {
      password: 'SuperSecretPlainPassword123!',
    },
  },
];

/**
 * Validates a dataset against the formal Zod LogRecordContractSchema
 */
export function validateLogDataset(records: unknown[]): ValidationSummary {
  const validEvents: LogEvent[] = [];
  const errors: ValidationSummary['errors'] = [];

  records.forEach((record, index) => {
    // Custom check: reject records with forbidden secrets
    const asObj = record as Record<string, unknown>;
    const metadata = asObj?.metadata as Record<string, unknown> | undefined;
    if (metadata && ('password' in metadata || 'token' in metadata || 'secret' in metadata)) {
      errors.push({
        index,
        testCase: asObj._test_case as string,
        error: 'Privacy Violation: Payload contains forbidden plain credential or token field',
        sample: record,
      });
      return;
    }

    const parseResult = LogRecordContractSchema.safeParse(record);

    if (parseResult.success) {
      const data = parseResult.data;
      validEvents.push({
        ...data,
        id: data.id || `evt-val-${index + 1}`,
      });
    } else {
      const formattedErrors = parseResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');

      errors.push({
        index,
        testCase: asObj?._test_case as string,
        error: formattedErrors,
        sample: record,
      });
    }
  });

  return {
    total: records.length,
    validCount: validEvents.length,
    invalidCount: errors.length,
    errors,
    validEvents,
  };
}

/**
 * Returns events for a selected category
 */
export function getDatasetEvents(category: DatasetCategory): LogEvent[] {
  switch (category) {
    case 'normal':
      return SYNTHETIC_LOG_EVENTS.filter((e) => !e.is_suspicious);
    case 'brute_force':
      return SYNTHETIC_LOG_EVENTS.filter(
        (e) => e.endpoint === '/api/auth/login' && (e.is_suspicious || e.status_code === 429)
      );
    case 'unauthorized':
      return SYNTHETIC_LOG_EVENTS.filter((e) => e.status_code === 403);
    case 'attendance_tampering':
      return SYNTHETIC_LOG_EVENTS.filter(
        (e) => e.event_type === 'attendance_modify' || e.event_type === 'attendance_mark'
      );
    case 'recon_injection':
      return SYNTHETIC_LOG_EVENTS.filter(
        (e) =>
          e.event_type === 'sql_injection_attempt' ||
          e.event_type === 'xss_attempt' ||
          e.event_type === 'not_found_probe'
      );
    case 'malformed_suite':
      return [];
    case 'all':
    default:
      return SYNTHETIC_LOG_EVENTS;
  }
}
