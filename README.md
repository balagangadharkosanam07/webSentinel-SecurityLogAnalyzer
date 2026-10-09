# WebSentinel & Student Attendance Portal — End-to-End Cyber Defense Platform

> **Defensive Platform Architecture:** WebSentinel is a defensive Security Operations Center (SOC) log analysis and risk assessment platform designed to ingest, normalize, and analyze web application telemetry from a PERN-stack target web app (**Student Attendance Portal**), detect suspicious activity using deterministic rule sets, correlate security alerts into incidents, and compute explainable risk scores ($0 \to 100$).

---

## 🏗️ Multi-Application Architecture & Port Topology

The monorepo contains two distinct, fully decoupled systems running side-by-side:

```
┌─────────────────────────────────────────────────────────────┐
│               TARGET WEB APPLICATION                        │
│   Student Attendance Portal (EduTrack)                      │
│   • Frontend UI: http://localhost:3001                      │
│   • Backend API: http://localhost:5000                      │
│   • Database: Neon PostgreSQL (portal_* tables)             │
│   • Features: Auth (JWT/Scrypt), RBAC, Roster, Tamper Demo │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Non-Blocking HTTP Ingestion
                               │ Headers: X-WebSentinel-Key
                               │ Redacted: Zero-Plain-Secrets
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               DEFENSIVE SOC PLATFORM                        │
│   WebSentinel Security Analytics                            │
│   • Frontend SOC UI: http://localhost:3000                  │
│   • Backend API:     http://localhost:4000                  │
│   • Database: Neon PostgreSQL (log_events, alerts, etc.)    │
│   • Features: Ingestion, Explorer, Rules, Incidents, Export │
└─────────────────────────────────────────────────────────────┘
```

| Service | Role | Port | Tech Stack | Primary Responsibilities |
|---|---|---|---|---|
| **WebSentinel Client** | Defensive SOC UI | `3000` | React 18, Vite, Tailwind CSS, Lucide | SOC Overview, Log Explorer, Threat Alerts, Incident Correlation, Risk Analytics, Audit Export |
| **WebSentinel Server** | Defensive API Engine | `4000` | Express, TypeScript, Drizzle ORM, Neon PostgreSQL | RFC-2026-WS Ingestion, 6 Detection Rules, Correlation Engine, Risk Scoring ($0 \to 100$) |
| **Attendance Portal Client** | Target Web App UI | `3001` | React 18, Vite, Tailwind CSS, Lucide | Student Attendance, Faculty Roll Call, Admin Center, Live Security Threat Simulation Sandbox |
| **Attendance Portal Server** | Target Web App API | `5000` | Express, TypeScript, Drizzle ORM, Neon PostgreSQL | Scrypt Hashing, RFC 7519 HMAC-SHA256 JWT, RBAC Guards, Non-blocking Asynchronous Logger |

---

## 🔒 Security Invariants & Zero-Plain-Secrets Policy

1. **Zero-Plain-Secrets Guarantee**:
   - Both the WebSentinel middleware and Attendance Portal client enforce recursive sanitization (`sanitizeLogPayload`).
   - Fields such as `password`, `passwd`, `token`, `secret`, `authorization`, `cookie`, `creditCard` are replaced with `[REDACTED]` prior to dispatch.
   - Plaintext credentials and tokens **never** appear in telemetry payloads, log tables, or console traces.

2. **Ingestion Authentication**:
   - The ingestion route `POST /api/logs/import` strictly validates the custom header `X-WebSentinel-Key`.
   - Unauthorized attempts receive HTTP `401 Unauthorized` (`MISSING_INGESTION_KEY` or `INVALID_INGESTION_KEY`).

3. **Non-Blocking Telemetry Dispatch**:
   - The logger middleware operates asynchronously with batch buffering and periodic flushes.
   - If WebSentinel is offline or restarts, Attendance Portal business operations continue without degradation or latency penalties.

4. **Sliding-Window Rate Limiter**:
   - WebSentinel ingestion endpoints are throttled to 120 requests/minute per IP, returning `429 Too Many Requests`.

---

## 📊 Complete 14-Phase Implementation Roadmap

Below is the definitive, comprehensive roadmap spanning all completed phases of WebSentinel and the Student Attendance Portal:

### Part I: WebSentinel SOC Defensive Platform
* **Phase 1: Architecture, SOC Theme & RFC-2026-WS Log Format**
  - Dark SOC color palette (`#070b14`), standard severity colors, and RFC-2026-WS schema design.
* **Phase 2: PostgreSQL / Neon Schema Design**
  - Drizzle ORM schemas for `log_events`, `detection_rules`, `alerts`, `incidents`, and `ingestion_batches`.
* **Phase 3: Backend Ingestion API & Security Invariants**
  - Express TypeScript setup, Zod environment validation, and global error handling with sanitized responses.
* **Phase 4: Database Migrations & Idempotent Seeding**
  - Live Neon PostgreSQL serverless connection, Drizzle migrations, and synthetic dataset seeders.
* **Phase 5: 7-Stage Validation Pipeline & Batch Log Ingestion**
  - Schema validation, deduplication keys (`dedup_id`), timestamp normalization, and batch insert transactions.
* **Phase 6: Log Explorer UI**
  - Real-time search, multi-filter by event type, status code, and IP, plus slide-over JSON detail inspector.
* **Phase 7: Rule-Based Threat Detection Engine**
  - Deterministic evaluation of 6 core rules:
    - `RULE-001`: Repeated Failed Logins (Brute Force)
    - `RULE-002`: High Frequency Auth Bursts (Credential Stuffing)
    - `RULE-003`: Privilege Escalation Attempts (Unauthorized Admin Probes)
    - `RULE-004`: Attendance Data Tampering Burst (Excessive Modifications)
    - `RULE-005`: Scanner / Reconnaissance Probing (404 sensitive routes)
    - `RULE-006`: SQL Injection Attack Attempts (`' OR '1'='1`)
* **Phase 8: Incident Correlation & Explainable Risk Scoring Engine**
  - Graph/actor clustering by Source IP, Actor ID, and Time Window.
  - Mathematical risk breakdown bounded $0 \to 100$: $\text{Risk} = \min(100, \text{Base} \times \text{Weight} + \text{VolumeBonus} + \text{AssetBonus})$.
  - Chronological kill-chain timeline reconstruction.
* **Phase 9: SOC Analytics Dashboard & Audit Reporting Export**
  - Overview KPI metrics, Recharts area trend charts, top threat actors, and streaming CSV audit report export.

### Part II: Target Application (Student Attendance Portal)
* **Phase 10: Ingestion API Security & Logger Middleware**
  - `X-WebSentinel-Key` header authentication, 120 req/min rate limiter, payload sanitization, and automated RFC event classifier.
* **Phase 11: Student Attendance Portal Backend**
  - Zero-dependency Scrypt password hashing with constant-time verification.
  - Zero-dependency RFC 7519 HMAC-SHA256 JWT generator and validator.
  - Role-Based Access Control (`requireRole('student' | 'teacher' | 'admin')`).
  - Attendance management, course directory, and admin telemetry endpoints.
  - Neon DB auto-migration (`initPortalTables`) and idempotent seeder (`portal_users`, `portal_courses`, `portal_attendance`).
* **Phase 12: Student Attendance Portal Frontend**
  - React 18, Vite, Tailwind CSS running on Port `3001`.
  - Quick-switch demo accounts (Student, Teacher, Administrator).
  - Student Dashboard: Attendance rate %, present/absent breakdown, session history table.
  - Teacher Dashboard: Course switcher, daily lecture roll call marking, bulk modification tool.
  - Admin Console: User directory listing, live SOC audit telemetry viewer.
  - Live Security Threat Sandbox: Interactive modal to trigger attacks against the portal with direct SOC feedback.

### Part III: End-to-End Simulation & Verification
* **Phase 13: End-to-End Live Attack Simulation & Correlation**
  - Interactive simulator script (`npm run simulate:attacks`) executing all 5 attack vectors against Port 5000, streaming to Port 4000, and validating correlated incidents.
* **Phase 14: Comprehensive Verification & Test Suite**
  - 66 automated tests passing across 10 test suites (47 WebSentinel + 19 Attendance Portal).
  - Clean production builds for all client and server targets.

---

## 🚀 Quickstart: Running Both Platforms

### 1. Install Monorepo Dependencies
```powershell
npm install
```

### 2. Seed Database Schemas & Default Accounts
Both platforms share the managed Neon PostgreSQL database using isolated table schemas:
```powershell
# Seed WebSentinel SOC rules, baseline alerts, and incidents
npm run db:seed

# Seed Attendance Portal users, courses, and sample rosters
npm run portal:server:seed
```

### 3. Start All Four Applications

Open four separate terminals or use background workers:

```powershell
# Terminal 1: WebSentinel SOC Backend (Port 4000)
npm run server:dev

# Terminal 2: WebSentinel SOC Frontend (Port 3000)
npm run client:dev

# Terminal 3: Attendance Portal Backend (Port 5000)
npm run portal:server:dev

# Terminal 4: Attendance Portal Frontend (Port 3001)
npm run portal:client:dev
```

---

## 🔑 Pre-Seeded Demo Accounts (Attendance Portal)

| Role | Email Address | Password | Permissions |
|---|---|---|---|
| **Student** | `student@portal.edu` | `StudentPassword2026!` | View personal attendance history, search courses |
| **Faculty / Teacher** | `teacher@portal.edu` | `TeacherPassword2026!` | Mark attendance roll calls, view class rosters |
| **Administrator** | `admin@portal.edu` | `AdminPassword2026!` | Manage user directory, inspect administrative audit logs |

---

## ⚡ Live Attack Simulation & Verification Walkthrough

You can execute attacks in two ways:

### Option A: From the Interactive Portal UI
1. Visit the Student Attendance Portal at **`http://localhost:3001`**.
2. Click the pulsing **"Security Sandbox"** button in the navigation header.
3. Click any of the attack buttons:
   - **SQL Injection Probe**: Injects `' OR '1'='1` into `/api/courses/search`.
   - **Reconnaissance Scanner**: Probes unmapped paths like `/.env` and `/wp-login.php`.
   - **Credential Stuffing**: Sends 5 rapid failed logins to `/api/auth/login`.
   - **Privilege Escalation**: Non-admin student attempts to access `/api/admin/audit-logs`.
   - **Attendance Tampering**: Dispatches bulk modifications to historical records.
4. Click **"Inspect in WebSentinel SOC"** to see the resulting alerts and correlated incidents on **`http://localhost:3000`**!

### Option B: Automated Headless Simulation Script
Run the automated end-to-end verification script from your terminal:
```powershell
npm run simulate:attacks
```

This script sends the attack payloads directly to Port `5000`, waits for logger batch flushes, executes the WebSentinel detection and correlation engines, and prints the generated alerts and incidents.

---

## 🧪 Automated Test Suites (66 / 66 Passing)

To run all automated test suites across the monorepo:

```powershell
# WebSentinel Platform Test Suites (47 tests across 9 suites)
npm run server:test

# Attendance Portal Test Suite (19 tests)
npm run portal:server:test
```

### Test Coverage Highlights:
- **Security Invariant Verification**: Redaction of sensitive fields in all log formats.
- **Authentication & RBAC**: Scrypt password verification, HMAC-SHA256 JWT tokens, and 401/403 guard enforcement.
- **Deduplication & Ingestion**: Strict idempotency on `dedup_id` and RFC-2026-WS compliance.
- **Detection & Correlation**: Automated verification of all 6 detection rules and deterministic incident risk scoring.
- **Report Streaming**: RFC 4180 CSV export validation with custom period filters.
