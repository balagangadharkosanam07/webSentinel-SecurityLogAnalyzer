import { z } from 'zod';
import { createHash } from 'crypto';
import { NewLogEvent } from '../db/schema/index.js';

export const HttpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
]);

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

export const ActorRoleSchema = z.enum(['admin', 'teacher', 'student', 'system']).nullable();

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'token',
  'secret',
  'authorization',
  'credit_card',
  'cvv',
  'api_key',
  'apikey',
]);

/**
 * Raw Ingestion Schema from external client (RFC-2026-WS-LOG)
 */
export const RawLogRecordSchema = z.object({
  id: z.string().optional(),
  timestamp: z.string().datetime({ message: 'Must be valid ISO-8601 UTC timestamp' }),
  event_type: LogEventTypeSchema,
  actor_id: z.string().max(64).nullable().optional(),
  actor_role: ActorRoleSchema.optional(),
  source_ip: z.string().refine(
    (ip) =>
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/.test(
        ip
      ),
    { message: 'Must be valid IPv4 or IPv6 address' }
  ),
  method: z.string().transform((m) => m.toUpperCase() as z.infer<typeof HttpMethodSchema>),
  endpoint: z.string().min(1).max(512),
  status_code: z.number().int().min(100).max(599),
  request_id: z.string().min(1).max(64),
  source_app: z.string().min(1).max(64).default('attendance-portal'),
  message: z.string().min(1).max(1024),
  duration_ms: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  dedup_id: z.string().max(128).optional(),
  is_suspicious: z.boolean().optional(),
  is_synthetic: z.boolean().default(false),
});

export type RawLogRecord = z.infer<typeof RawLogRecordSchema>;

export const IngestionBatchInputSchema = z.object({
  source: z.string().min(1).default('attendance-portal'),
  logs: z.array(z.unknown()).min(1, 'logs array must contain at least 1 record'),
});

export type IngestionBatchInput = z.infer<typeof IngestionBatchInputSchema>;

/**
 * Recursively scans metadata and rejects or redacts forbidden secret keys
 */
export function sanitizeMetadata(metadata?: Record<string, unknown>): {
  sanitized: Record<string, unknown>;
  violation: boolean;
  violatedKey?: string;
} {
  if (!metadata || typeof metadata !== 'object') {
    return { sanitized: {}, violation: false };
  }

  let violation = false;
  let violatedKey: string | undefined;

  function deepScan(obj: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        violation = true;
        violatedKey = key;
        clean[key] = '[REDACTED_BY_PIPELINE]';
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        clean[key] = deepScan(val as Record<string, unknown>);
      } else {
        clean[key] = val;
      }
    }
    return clean;
  }

  const sanitized = deepScan(metadata);
  return { sanitized, violation, violatedKey };
}

/**
 * Calculates deterministic SHA-256 deduplication hash for an event
 */
export function computeDedupId(record: {
  source_app: string;
  request_id: string;
  timestamp: string;
  source_ip: string;
  endpoint: string;
}): string {
  const rawString = `${record.source_app}|${record.request_id}|${record.timestamp}|${record.source_ip}|${record.endpoint}`;
  return createHash('sha256').update(rawString).digest('hex');
}

export type ValidationOutcome =
  | { success: true; normalized: NewLogEvent }
  | { success: false; errors: string[] };

/**
 * Validates, sanitizes, and normalizes a single raw record
 */
export function validateAndNormalizeRecord(raw: unknown): ValidationOutcome {
  const parseResult = RawLogRecordSchema.safeParse(raw);

  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    return { success: false, errors };
  }

  const data = parseResult.data;

  // Enforce Privacy Policy: Check for forbidden plaintext secret credentials
  const { sanitized, violation, violatedKey } = sanitizeMetadata(data.metadata);
  if (violation) {
    return {
      success: false,
      errors: [
        `Privacy Violation: Payload contains forbidden plain credential/token parameter '${violatedKey}'. Logs must never contain plain authentication secrets.`,
      ],
    };
  }

  // Deduplication key generation
  const dedupId =
    data.dedup_id ||
    computeDedupId({
      source_app: data.source_app,
      request_id: data.request_id,
      timestamp: data.timestamp,
      source_ip: data.source_ip,
      endpoint: data.endpoint,
    });

  // Map to PostgreSQL Drizzle NewLogEvent model
  const normalized: NewLogEvent = {
    timestamp: data.timestamp,
    eventType: data.event_type,
    sourceIp: data.source_ip,
    method: data.method,
    endpoint: data.endpoint,
    statusCode: data.status_code,
    actorId: data.actor_id || null,
    actorRole: data.actor_role || null,
    requestId: data.request_id,
    sourceApp: data.source_app,
    message: data.message,
    durationMs: data.duration_ms || null,
    metadata: sanitized,
    dedupId,
    isSuspicious: data.is_suspicious ?? false,
    isSynthetic: data.is_synthetic ?? false,
  };

  return { success: true, normalized };
}
