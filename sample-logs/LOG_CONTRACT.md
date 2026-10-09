# WebSentinel Ingestion Log Contract (RFC-2026-WS-LOG)

## 1. Document Overview
This document defines the formal JSON log schema contract between client web applications (such as the **PERN Student Attendance Portal**) and the **WebSentinel** security log analysis and risk assessment platform.

Any application producing structured security telemetry MUST adhere to this contract to guarantee deterministic validation, normalization, and detection accuracy.

---

## 2. Security & Privacy Non-Negotiables

> [!CAUTION]
> **Zero Plain Secrets Policy:**
> Under no circumstances may client applications send plaintext passwords, JWT session tokens, session cookies, `Authorization` headers, or unmasked sensitive student Personally Identifiable Information (PII) in log payloads.

- **Actors:** Must use pseudonymous identifiers (e.g. `usr-adm-9901`, `usr-tch-1002`, `usr-std-3021`). Never send real student national IDs, social security numbers, or full student home addresses.
- **Payload Redaction:** Client-side middleware must sanitize or omit request body parameters named `password`, `token`, `secret`, `authorization`, `credit_card`, or `otp`.

---

## 3. JSON Field Contract Specification

| Field Name | Type | Required? | Constraints & Normalization Rules | Description / Example |
| :--- | :--- | :--- | :--- | :--- |
| `timestamp` | `string` | **Yes** | ISO-8601 UTC format: `YYYY-MM-DDTHH:mm:ss.sssZ` or `...Z`. Ingestion will reject dates older than 30 days or in the future (>5 min clock skew). | `"2026-10-09T08:14:02Z"` |
| `event_type` | `string` | **Yes** | Enum constraint (lowercase snake_case): `login_success`, `login_failed`, `access_denied`, `attendance_mark`, `attendance_modify`, `rate_limit_exceeded`, `not_found_probe`, `sql_injection_attempt`, `xss_attempt`, `app_error`. | `"login_failed"` |
| `actor_id` | `string \| null` | **Yes** | String (max 64 chars) or `null` for unauthenticated requests. Must be a pseudonymous token. | `"usr-tch-1002"` or `null` |
| `actor_role` | `string \| null` | **Yes** | Enum or `null`: `'admin'`, `'teacher'`, `'student'`, `'system'`. | `"teacher"` or `null` |
| `source_ip` | `string` | **Yes** | Valid IPv4 or IPv6 address. Normalized to canonical representation. Private IPs (e.g., internal LAN `10.0.0.0/8`, `192.168.0.0/16`) are permitted. | `"198.51.100.42"` |
| `method` | `string` | **Yes** | Normalized to uppercase: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`. | `"POST"` |
| `endpoint` | `string` | **Yes** | Uniform route path (max 512 chars). Query parameters containing tokens or sessions must be stripped prior to shipping. | `"/api/auth/login"` |
| `status_code` | `integer` | **Yes** | Standard HTTP status integer `100 <= status_code <= 599`. | `401` |
| `request_id` | `string` | **Yes** | Unique request trace ID generated per HTTP request (e.g. UUIDv4 or `req-` prefixed alphanumeric, max 64 chars). | `"req-syn-a101"` |
| `source_app` | `string` | **Yes** | Lowercase alphanumeric slug identifying the emitting application (max 64 chars). | `"attendance-portal"` |
| `message` | `string` | **Yes** | Safe diagnostic description (max 1024 chars). No unmasked secrets. | `"Authentication failed: invalid credentials"` |
| `duration_ms` | `integer` | No | Optional request execution duration in milliseconds (`>= 0`). | `45` |
| `metadata` | `object` | No | Optional key-value object containing safe domain-specific parameters (e.g. `attempted_username`, `class_id`, `modified_count`, `scanner_signature`). | `{"attempted_username": "admin@school.edu"}` |
| `dedup_id` | `string` | No | Optional client-computed idempotency key. If omitted, WebSentinel generates `SHA-256(source_app + request_id + timestamp + source_ip)`. | `"dedup-8f12a3"` |

---

## 4. Deduplication & Idempotency Specification

To ensure log ingestion can safely handle network retries, proxy retransmissions, or batch resends without inflating metrics or creating duplicate alerts, each record is mapped to a deterministic deduplication hash:

$$\text{dedup\_id} = \text{SHA256}(\text{source\_app} \mathbin{\Vert} \text{request\_id} \mathbin{\Vert} \text{timestamp} \mathbin{\Vert} \text{source\_ip} \mathbin{\Vert} \text{endpoint})$$

- If an incoming event matches an existing `dedup_id` within the retention window, it is safely recorded as a duplicate and omitted from rule evaluation counters.

---

## 5. Zod Schema Definition

The backend ingestion pipeline and frontend validators enforce the following Zod definition:

```typescript
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

export const LogRecordContractSchema = z.object({
  timestamp: z.string().datetime({ message: 'Must be valid ISO-8601 UTC timestamp' }),
  event_type: LogEventTypeSchema,
  actor_id: z.string().max(64).nullable(),
  actor_role: z.enum(['admin', 'teacher', 'student', 'system']).nullable(),
  source_ip: z.string().ip({ message: 'Must be valid IPv4 or IPv6 address' }),
  method: HttpMethodSchema,
  endpoint: z.string().min(1).max(512),
  status_code: z.number().int().min(100).max(599),
  request_id: z.string().min(1).max(64),
  source_app: z.string().min(1).max(64),
  message: z.string().min(1).max(1024),
  duration_ms: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
  dedup_id: z.string().max(128).optional(),
});

export const LogBatchContractSchema = z.array(LogRecordContractSchema);
```

---

## 6. Sample Normal and Attack Scenarios

### 6.1 Normal Attendance Marking
```json
{
  "timestamp": "2026-10-09T08:22:45Z",
  "event_type": "attendance_mark",
  "actor_id": "usr-tch-1002",
  "actor_role": "teacher",
  "source_ip": "10.0.5.12",
  "method": "POST",
  "endpoint": "/api/attendance/classes/CS101/sessions",
  "status_code": 201,
  "request_id": "req-norm-101",
  "source_app": "attendance-portal",
  "message": "Attendance marked: 38 present for session 12",
  "duration_ms": 110,
  "metadata": {
    "class_id": "CS101",
    "present_count": 38
  }
}
```

### 6.2 Credential Brute Force & Account Takeover
```json
{
  "timestamp": "2026-10-09T08:14:02Z",
  "event_type": "login_failed",
  "actor_id": null,
  "actor_role": null,
  "source_ip": "198.51.100.42",
  "method": "POST",
  "endpoint": "/api/auth/login",
  "status_code": 401,
  "request_id": "req-bf-001",
  "source_app": "attendance-portal",
  "message": "Authentication failed: invalid credentials",
  "duration_ms": 45,
  "metadata": {
    "attempted_username": "admin@school.edu"
  }
}
```
*(Followed sequentially by further 401s and an unexpected 200 OK from the same source IP)*

### 6.3 SQL Injection Probe
```json
{
  "timestamp": "2026-10-09T09:05:00Z",
  "event_type": "sql_injection_attempt",
  "actor_id": null,
  "actor_role": null,
  "source_ip": "192.0.2.190",
  "method": "GET",
  "endpoint": "/api/attendance/students?class_id=CS101%27%20OR%201=1--",
  "status_code": 400,
  "request_id": "req-sqli-001",
  "source_app": "attendance-portal",
  "message": "Suspicious payload intercepted: SQL escape pattern",
  "duration_ms": 22,
  "metadata": {
    "query_param": "class_id",
    "matched_pattern": "(' OR 1=1--)"
  }
}
```
