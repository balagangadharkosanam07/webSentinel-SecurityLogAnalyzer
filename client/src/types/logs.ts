import { z } from 'zod';

export const HttpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const LogEventTypeSchema = z.enum([
  'login_success',
  'login_failed',
  'access_denied',
  'attendance_mark',
  'attendance_modify',
  'rate_limit_exceeded',
  'not_found_probe',
  'sql_injection_attempt',
  'xss_attempt',
  'app_error',
]);
export type LogEventType = z.infer<typeof LogEventTypeSchema>;

export const ActorRoleSchema = z.enum(['admin', 'teacher', 'student', 'system']).nullable();
export type ActorRole = z.infer<typeof ActorRoleSchema>;

/**
 * Formal Log Record Contract Schema (RFC-2026-WS-LOG)
 * Used by ingestion middleware to validate and normalize raw telemetry payloads.
 */
export const LogRecordContractSchema = z.object({
  id: z.string().optional(),
  timestamp: z.string().datetime({ message: 'Must be valid ISO-8601 UTC timestamp' }),
  event_type: LogEventTypeSchema,
  actor_id: z.string().max(64).nullable(),
  actor_role: ActorRoleSchema,
  source_ip: z.string().refine(
    (ip) =>
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/.test(
        ip
      ),
    { message: 'Must be valid IPv4 or IPv6 address' }
  ),
  method: HttpMethodSchema,
  endpoint: z.string().min(1).max(512),
  status_code: z.number().int().min(100).max(599),
  request_id: z.string().min(1).max(64),
  source_app: z.string().min(1).max(64),
  message: z.string().min(1).max(1024),
  duration_ms: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  dedup_id: z.string().max(128).optional(),
  is_suspicious: z.boolean().optional(),
  is_synthetic: z.boolean().default(true),
});

export type LogRecordContract = z.infer<typeof LogRecordContractSchema>;

export interface LogEvent extends LogRecordContract {
  id: string;
}

export interface LogFilterParams {
  searchQuery?: string;
  eventType?: string;
  sourceIp?: string;
  statusCode?: string;
  startDate?: string;
  endDate?: string;
  actorRole?: string;
  onlySuspicious?: boolean;
}

/**
 * Generates deterministic deduplication string for idempotency checks
 */
export function generateDedupKey(record: {
  source_app: string;
  request_id: string;
  timestamp: string;
  source_ip: string;
  endpoint: string;
}): string {
  return `${record.source_app}|${record.request_id}|${record.timestamp}|${record.source_ip}|${record.endpoint}`;
}
