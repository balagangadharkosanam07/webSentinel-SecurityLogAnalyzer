import { db, pool } from '../index.js';
import {
  detectionRules,
  incidents,
  alerts,
  logEvents,
  ingestionBatches,
} from '../schema/index.js';
import { logger } from '../../utils/logger.js';

export async function seedDatabase() {
  logger.info('🌱 Starting database seed into Neon PostgreSQL...');

  try {
    // 1. Seed Detection Rules
    logger.info('   -> Seeding detection rules...');
    await db
      .insert(detectionRules)
      .values([
        {
          id: 'RULE-001',
          name: 'Repeated Failed Logins',
          description: 'Detects 3 or more failed authentication attempts from the same IP within a 5-minute rolling window.',
          category: 'authentication',
          severity: 'high',
          configuration: { threshold: 3, window_seconds: 300 },
          enabled: true,
          version: 1,
        },
        {
          id: 'RULE-002',
          name: 'Suspicious Login Sequence',
          description: 'Correlates repeated login failures followed rapidly by a successful login from the same source IP.',
          category: 'authentication',
          severity: 'critical',
          configuration: { failure_threshold: 3, success_window_seconds: 60 },
          enabled: true,
          version: 1,
        },
        {
          id: 'RULE-003',
          name: 'Unauthorized Access Attempt',
          description: 'Detects HTTP 403 Forbidden responses on restricted administrative or reporting endpoints.',
          category: 'access_control',
          severity: 'medium',
          configuration: { protected_prefixes: ['/api/admin', '/api/system'] },
          enabled: true,
          version: 1,
        },
        {
          id: 'RULE-004',
          name: 'Unusual Attendance Modifications',
          description: 'Detects bulk retroactive modifications of attendance records outside standard grading cycles.',
          category: 'behavioral',
          severity: 'high',
          configuration: { batch_threshold: 10, max_age_days: 7 },
          enabled: true,
          version: 1,
        },
        {
          id: 'RULE-005',
          name: 'Request Flooding & Route Probing',
          description: 'Identifies rapid sequential 404 responses or 429 rate limit trips signaling scanner activity.',
          category: 'reconnaissance',
          severity: 'medium',
          configuration: { not_found_threshold: 5, window_seconds: 60 },
          enabled: true,
          version: 1,
        },
        {
          id: 'RULE-006',
          name: 'Injection Indicators',
          description: 'Flags input payloads containing SQL syntax fragments or unescaped script tags.',
          category: 'injection',
          severity: 'critical',
          configuration: { inspect_params: true, inspect_body: true },
          enabled: true,
          version: 1,
        },
      ])
      .onConflictDoNothing({ target: detectionRules.id });

    // 2. Seed Incidents
    logger.info('   -> Seeding correlated incidents...');
    await db
      .insert(incidents)
      .values([
        {
          id: 'INC-2026-001',
          title: 'Account Takeover Attempt: Admin Portal Access via Brute Force',
          description: 'Multiple failed logins followed immediately by successful session acquisition on administrative account from untrusted public IP 198.51.100.42.',
          severity: 'critical',
          status: 'open',
          primarySourceIp: '198.51.100.42',
          targetedAsset: '/api/auth/login (Admin Account)',
          riskScore: 90,
          riskBreakdown: {
            base_score: 50,
            frequency_multiplier: 15,
            criticality_weight: 25,
            unauthorized_factor: 0,
            total_score: 90,
            rationale: 'Base score 50 (Critical rule) + 15 (event concentration) + 25 (Admin role compromised).',
          },
          firstSeen: '2026-10-09T08:14:02Z',
          lastSeen: '2026-10-09T08:14:35Z',
          isSynthetic: true,
        },
        {
          id: 'INC-2026-002',
          title: 'Anomalous Historical Attendance Modification',
          description: 'Bulk update altering 14 historical records exceeding normal 7-day policy window performed by teacher usr-tch-1002.',
          severity: 'high',
          status: 'investigating',
          primarySourceIp: '10.0.5.12',
          targetedAsset: '/api/attendance/records/bulk-update',
          riskScore: 70,
          riskBreakdown: {
            base_score: 40,
            frequency_multiplier: 10,
            criticality_weight: 20,
            unauthorized_factor: 0,
            total_score: 70,
            rationale: 'Base score 40 (High rule) + 10 (14 records) + 20 (Target grade store).',
          },
          firstSeen: '2026-10-09T08:35:12Z',
          lastSeen: '2026-10-09T08:35:12Z',
          isSynthetic: true,
        },
        {
          id: 'INC-2026-003',
          title: 'Automated Reconnaissance & Injection Probing Campaign',
          description: 'External IP 192.0.2.190 launched rapid sequential reconnaissance probes (.env, wp-login) combined with SQL injection attack payloads.',
          severity: 'high',
          status: 'investigating',
          primarySourceIp: '192.0.2.190',
          targetedAsset: '/api/attendance/students & System Configs',
          riskScore: 80,
          riskBreakdown: {
            base_score: 45,
            frequency_multiplier: 12,
            criticality_weight: 18,
            unauthorized_factor: 5,
            total_score: 80,
            rationale: 'Base score 45 (SQLi) + 12 (multiple scanner probes) + 18 (API exposure) + 5 (unauthenticated).',
          },
          firstSeen: '2026-10-09T09:05:00Z',
          lastSeen: '2026-10-09T09:05:06Z',
          isSynthetic: true,
        },
      ])
      .onConflictDoNothing({ target: incidents.id });

    // 3. Seed Alerts
    logger.info('   -> Seeding threat alerts...');
    await db
      .insert(alerts)
      .values([
        {
          id: 'ALT-2026-001',
          ruleId: 'RULE-002',
          incidentId: 'INC-2026-001',
          title: 'Brute Force Success: admin@school.edu Compromise Suspected',
          description: 'Source IP 198.51.100.42 failed 4 login attempts before authenticating as admin user usr-adm-9901.',
          severity: 'critical',
          status: 'open',
          sourceIp: '198.51.100.42',
          actorId: 'usr-adm-9901',
          evidenceStrength: 'strong',
          evidenceSummary: '4 consecutive 401s in 33 seconds followed by 200 OK for administrative account.',
          supportingEventIds: ['evt-syn-001', 'evt-syn-002', 'evt-syn-003', 'evt-syn-004', 'evt-syn-005'],
          detectedAt: '2026-10-09T08:14:35Z',
          isSynthetic: true,
        },
        {
          id: 'ALT-2026-002',
          ruleId: 'RULE-006',
          incidentId: 'INC-2026-003',
          title: 'SQL Injection Probe Detected on Attendance Query',
          description: 'Source IP 192.0.2.190 submitted SQL syntax fragment (OR 1=1--) in class_id filter parameter.',
          severity: 'critical',
          status: 'open',
          sourceIp: '192.0.2.190',
          actorId: null,
          evidenceStrength: 'strong',
          evidenceSummary: 'Target parameter class_id contained Boolean SQL bypass payload.',
          supportingEventIds: ['evt-syn-009'],
          detectedAt: '2026-10-09T09:05:00Z',
          isSynthetic: true,
        },
        {
          id: 'ALT-2026-003',
          ruleId: 'RULE-004',
          incidentId: 'INC-2026-002',
          title: 'Abnormal Bulk Retroactive Record Modification',
          description: 'Teacher usr-tch-1002 modified 14 attendance records older than 45 days in single batch.',
          severity: 'high',
          status: 'investigating',
          sourceIp: '10.0.5.12',
          actorId: 'usr-tch-1002',
          evidenceStrength: 'moderate',
          evidenceSummary: 'Batch edit bypassed usual 7-day correction grace period; 14 records altered simultaneously.',
          supportingEventIds: ['evt-syn-008'],
          detectedAt: '2026-10-09T08:35:12Z',
          isSynthetic: true,
        },
        {
          id: 'ALT-2026-004',
          ruleId: 'RULE-005',
          incidentId: 'INC-2026-003',
          title: 'Automated Route Enumeration / Scanner Detected',
          description: 'Repeated 404 probes against configuration files (.env) and known CMS backdoors.',
          severity: 'medium',
          status: 'investigating',
          sourceIp: '192.0.2.190',
          actorId: null,
          evidenceStrength: 'strong',
          evidenceSummary: 'Sequential scans against non-existent endpoints with DirBuster user agent signature.',
          supportingEventIds: ['evt-syn-010', 'evt-syn-011'],
          detectedAt: '2026-10-09T09:05:06Z',
          isSynthetic: true,
        },
        {
          id: 'ALT-2026-005',
          ruleId: 'RULE-003',
          incidentId: null,
          title: 'Privilege Escalation Attempt on Audit Log Endpoint',
          description: 'Student account usr-std-3021 attempted direct GET request to /api/admin/system/audit-logs.',
          severity: 'medium',
          status: 'resolved',
          sourceIp: '203.0.113.88',
          actorId: 'usr-std-3021',
          evidenceStrength: 'moderate',
          evidenceSummary: 'Single HTTP 403 logged for student role targeting restricted admin resource.',
          supportingEventIds: ['evt-syn-006'],
          detectedAt: '2026-10-09T08:20:10Z',
          isSynthetic: true,
        },
        {
          id: 'ALT-2026-006',
          ruleId: 'RULE-006',
          incidentId: null,
          title: 'Reflected XSS Script Injection Attempt in Student Remarks',
          description: 'Student usr-std-5512 submitted script tag payload into remarks text field.',
          severity: 'high',
          status: 'open',
          sourceIp: '203.0.113.14',
          actorId: 'usr-std-5512',
          evidenceStrength: 'strong',
          evidenceSummary: 'Payload <script>alert("xss")</script> intercepted by input validation middleware.',
          supportingEventIds: ['evt-syn-014'],
          detectedAt: '2026-10-09T09:45:00Z',
          isSynthetic: true,
        },
      ])
      .onConflictDoNothing({ target: alerts.id });

    // 4. Seed Ingestion Batches
    logger.info('   -> Seeding initial ingestion batch audit...');
    await db
      .insert(ingestionBatches)
      .values([
        {
          sourceApp: 'attendance-portal',
          totalRecords: 15,
          acceptedRecords: 15,
          rejectedRecords: 0,
          status: 'completed',
          errorSummary: [],
        },
      ]);

    // 5. Seed Log Events
    logger.info('   -> Seeding normalized log events...');
    const sampleEvents = [
      {
        timestamp: '2026-10-09T08:14:02Z',
        eventType: 'login_failed',
        actorId: null,
        actorRole: null,
        sourceIp: '198.51.100.42',
        method: 'POST',
        endpoint: '/api/auth/login',
        statusCode: 401,
        requestId: 'req-syn-a101',
        sourceApp: 'attendance-portal',
        message: 'Authentication failed: invalid credentials for user admin@school.edu',
        durationMs: 45,
        metadata: { attempted_username: 'admin@school.edu' },
        dedupId: 'attendance-portal|req-syn-a101|2026-10-09T08:14:02Z|198.51.100.42|/api/auth/login',
        isSuspicious: true,
        isSynthetic: true,
      },
      {
        timestamp: '2026-10-09T08:14:08Z',
        eventType: 'login_failed',
        actorId: null,
        actorRole: null,
        sourceIp: '198.51.100.42',
        method: 'POST',
        endpoint: '/api/auth/login',
        statusCode: 401,
        requestId: 'req-syn-a102',
        sourceApp: 'attendance-portal',
        message: 'Authentication failed: invalid credentials for user admin@school.edu',
        durationMs: 42,
        metadata: { attempted_username: 'admin@school.edu' },
        dedupId: 'attendance-portal|req-syn-a102|2026-10-09T08:14:08Z|198.51.100.42|/api/auth/login',
        isSuspicious: true,
        isSynthetic: true,
      },
      {
        timestamp: '2026-10-09T08:14:15Z',
        eventType: 'login_failed',
        actorId: null,
        actorRole: null,
        sourceIp: '198.51.100.42',
        method: 'POST',
        endpoint: '/api/auth/login',
        statusCode: 401,
        requestId: 'req-syn-a103',
        sourceApp: 'attendance-portal',
        message: 'Authentication failed: invalid credentials for user admin@school.edu',
        durationMs: 48,
        metadata: { attempted_username: 'admin@school.edu' },
        dedupId: 'attendance-portal|req-syn-a103|2026-10-09T08:14:15Z|198.51.100.42|/api/auth/login',
        isSuspicious: true,
        isSynthetic: true,
      },
      {
        timestamp: '2026-10-09T08:14:22Z',
        eventType: 'login_failed',
        actorId: null,
        actorRole: null,
        sourceIp: '198.51.100.42',
        method: 'POST',
        endpoint: '/api/auth/login',
        statusCode: 401,
        requestId: 'req-syn-a104',
        sourceApp: 'attendance-portal',
        message: 'Authentication failed: invalid credentials for user admin@school.edu',
        durationMs: 41,
        metadata: { attempted_username: 'admin@school.edu' },
        dedupId: 'attendance-portal|req-syn-a104|2026-10-09T08:14:22Z|198.51.100.42|/api/auth/login',
        isSuspicious: true,
        isSynthetic: true,
      },
      {
        timestamp: '2026-10-09T08:14:35Z',
        eventType: 'login_success',
        actorId: 'usr-adm-9901',
        actorRole: 'admin',
        sourceIp: '198.51.100.42',
        method: 'POST',
        endpoint: '/api/auth/login',
        statusCode: 200,
        requestId: 'req-syn-a105',
        sourceApp: 'attendance-portal',
        message: 'Authentication succeeded after 4 previous failures within 35 seconds',
        durationMs: 62,
        metadata: { session_duration_hrs: 8 },
        dedupId: 'attendance-portal|req-syn-a105|2026-10-09T08:14:35Z|198.51.100.42|/api/auth/login',
        isSuspicious: true,
        isSynthetic: true,
      },
      {
        timestamp: '2026-10-09T08:20:10Z',
        eventType: 'access_denied',
        actorId: 'usr-std-3021',
        actorRole: 'student',
        sourceIp: '203.0.113.88',
        method: 'GET',
        endpoint: '/api/admin/system/audit-logs',
        statusCode: 403,
        requestId: 'req-syn-b201',
        sourceApp: 'attendance-portal',
        message: 'Access denied: Role student is not permitted on route /api/admin/system/audit-logs',
        durationMs: 18,
        metadata: { required_role: 'admin' },
        dedupId: 'attendance-portal|req-syn-b201|2026-10-09T08:20:10Z|203.0.113.88|/api/admin/system/audit-logs',
        isSuspicious: true,
        isSynthetic: true,
      },
      {
        timestamp: '2026-10-09T08:22:45Z',
        eventType: 'attendance_mark',
        actorId: 'usr-tch-1002',
        actorRole: 'teacher',
        sourceIp: '10.0.5.12',
        method: 'POST',
        endpoint: '/api/attendance/classes/CS101/sessions',
        statusCode: 201,
        requestId: 'req-syn-c301',
        sourceApp: 'attendance-portal',
        message: 'Attendance recorded: 38 students marked present for CS101 session 12',
        durationMs: 110,
        metadata: { class_id: 'CS101', present_count: 38 },
        dedupId: 'attendance-portal|req-syn-c301|2026-10-09T08:22:45Z|10.0.5.12|/api/attendance/classes/CS101/sessions',
        isSuspicious: false,
        isSynthetic: true,
      },
      {
        timestamp: '2026-10-09T08:35:12Z',
        eventType: 'attendance_modify',
        actorId: 'usr-tch-1002',
        actorRole: 'teacher',
        sourceIp: '10.0.5.12',
        method: 'PATCH',
        endpoint: '/api/attendance/records/bulk-update',
        statusCode: 200,
        requestId: 'req-syn-c340',
        sourceApp: 'attendance-portal',
        message: 'Unusual batch update: modified 14 historical attendance records for prior months',
        durationMs: 240,
        metadata: { modified_count: 14, historical_delta_days: 45 },
        dedupId: 'attendance-portal|req-syn-c340|2026-10-09T08:35:12Z|10.0.5.12|/api/attendance/records/bulk-update',
        isSuspicious: true,
        isSynthetic: true,
      },
      {
        timestamp: '2026-10-09T09:05:00Z',
        eventType: 'sql_injection_attempt',
        actorId: null,
        actorRole: null,
        sourceIp: '192.0.2.190',
        method: 'GET',
        endpoint: '/api/attendance/students?class_id=CS101%27%20OR%201=1--',
        statusCode: 400,
        requestId: 'req-syn-d401',
        sourceApp: 'attendance-portal',
        message: 'Suspicious payload detected: SQL escape pattern detected in query parameter',
        durationMs: 22,
        metadata: { query_param: 'class_id', matched_pattern: "(' OR 1=1--)" },
        dedupId: 'attendance-portal|req-syn-d401|2026-10-09T09:05:00Z|192.0.2.190|/api/attendance/students?class_id=CS101%27%20OR%201=1--',
        isSuspicious: true,
        isSynthetic: true,
      },
      {
        timestamp: '2026-10-09T09:05:03Z',
        eventType: 'not_found_probe',
        actorId: null,
        actorRole: null,
        sourceIp: '192.0.2.190',
        method: 'GET',
        endpoint: '/.env',
        statusCode: 404,
        requestId: 'req-syn-d402',
        sourceApp: 'attendance-portal',
        message: 'Route probe: attempted access to hidden configuration file',
        durationMs: 12,
        metadata: { scanner_signature: 'DirBuster/1.0' },
        dedupId: 'attendance-portal|req-syn-d402|2026-10-09T09:05:03Z|192.0.2.190|/.env',
        isSuspicious: true,
        isSynthetic: true,
      },
    ];

    for (const evt of sampleEvents) {
      await db
        .insert(logEvents)
        .values(evt)
        .onConflictDoNothing({ target: logEvents.dedupId });
    }

    logger.info('🎉 Seed completed successfully into Neon PostgreSQL!');
  } catch (error) {
    logger.error('❌ Seeding error:', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

// Run standalone if executed directly
if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  seedDatabase()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async () => {
      await pool.end();
      process.exit(1);
    });
}
