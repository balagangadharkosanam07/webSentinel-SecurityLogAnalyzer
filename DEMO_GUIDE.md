# WebSentinel & Student Attendance Portal — Live Demonstration & Evaluation Guide

This guide provides a structured 5-minute walkthrough for demonstrating the end-to-end cyber defense platform to evaluators, professors, or team members.

---

## ⏱️ Pre-Demo Checklist (1 Minute)

Ensure your database is seeded and the services are running:

```powershell
# 1. Start all 4 services concurrently in one command:
npm run dev:all
```

Open two browser tabs:
- **Tab 1 (Target App):** `http://localhost:3001` (Student Attendance Portal)
- **Tab 2 (Defensive SOC):** `http://localhost:3000` (WebSentinel SOC)

---

## 🎬 5-Step Live Demonstration Script

### Step 1: Demonstrate Target Application & Multi-Tenant RBAC (Port 3001)
1. Navigate to `http://localhost:3001`.
2. Notice the **Role Switcher** buttons:
   - Click **👨‍🎓 Student** (`student@portal.edu`) $\to$ Sign in.
   - Show the **Student Attendance Record**: Overall attendance rate (%), Present/Late/Absent breakdown, and lecture history table.
   - Click **Sign Out**.
3. Sign in as **👨‍🏫 Teacher** (`teacher@portal.edu`).
   - Show the **Class Roster**: Select course `CS101`, pick today's date, and mark a student as **Present**, **Late**, or **Absent** with 1-click.
   - Explain: *"Every roll call transaction is asynchronously streamed to WebSentinel as a non-blocking security log."*
4. Click **Sign Out** and sign in as **🛡️ Admin** (`admin@portal.edu`).
   - Show the **RBAC & Security Telemetry Center**: Registered user accounts and live SOC relay connection status.

---

### Step 2: Trigger Live Security Anomalies (The Security Sandbox)
1. In the Attendance Portal header, click the pulsing **"⚡ Security Sandbox"** button.
2. Explain: *"The portal includes a safe threat simulator to test SOC detection rules against real HTTP traffic."*
3. Execute the attack vectors:
   - **Click "SQL Injection Probe"**: Injects `' OR '1'='1 -- UNION SELECT` into the course catalog search (`RULE-006`).
   - **Click "Reconnaissance Scanner"**: Probes sensitive unmapped routes like `/.env` and `/wp-login.php` (`RULE-005`).
   - **Click "Credential Stuffing Burst"**: Dispatches 5 rapid failed authentication calls to `/api/auth/login` (`RULE-001/002`).
   - **Click "Privilege Escalation"**: Attempts unauthorized access to `/api/admin/audit-logs` returning HTTP 403 (`RULE-003`).
   - **Click "Attendance Tampering Burst"**: Submits rapid bulk modifications to historical records (`RULE-004`).
4. Show the live output in the terminal feed within the modal.
5. Click **"Inspect in WebSentinel SOC"** (or switch to Tab 2).

---

### Step 3: WebSentinel SOC Overview & Real-Time Ingestion (Port 3000)
1. Switch to `http://localhost:3000`.
2. Point out:
   - **Dark SOC Theme:** Professional security operations center layout (`#070b14`).
   - **KPI Cards:** Total Events Ingested, Suspicious Activity Rate %, Active Alerts, Correlated Incidents.
   - **24-Hour Event Volume Trend:** Area chart showing volume spikes during the attack bursts.
   - **Recent Security Activity:** Live event stream displaying the newly ingested telemetry from Port 5000.

---

### Step 4: Deep Dive into Log Explorer & Threat Alerts
1. Click **Log Explorer** (`/logs`):
   - Highlight the **Zero-Plain-Secrets Policy**: Point to the sanitized metadata — passwords and bearer tokens are automatically replaced with `[REDACTED]`.
   - Use the **Event Type Filter** dropdown $\to$ Filter by `sql_injection_attempt` or `login_failed`.
   - Click any log row to open the **JSON Slide-Over Drawer** showing full RFC-2026-WS metadata.
2. Click **Threat Alerts** (`/alerts`):
   - Show the rule-based alerts triggered by the detection engine (`RULE-001` through `RULE-006`).
   - Demonstrate the alert triage selector: change status from `New` $\to$ `Investigating` $\to$ `Resolved`.

---

### Step 5: Incident Correlation, Explainable Risk Score & Audit Export
1. Click **Incidents** (`/incidents`):
   - Explain: *"WebSentinel doesn't just display isolated alerts; it clusters them by Threat Actor IP and time window into Correlated Security Incidents."*
   - Select the highest-risk incident.
   - Highlight the **Explainable Risk Score ($0 \to 100$)**:
     $$\text{Risk Score} = \min(100, \text{Base Severity} + \text{Volume Bonus} + \text{Asset Multiplier})$$
     Show the mathematical rationale breakdown card explaining exactly why the score was assigned.
   - Walk through the **Reconstructed Kill-Chain Timeline**: Reconnaissance $\to$ Weaponization/Auth Probe $\to$ Privilege Exploitation $\to$ Impact.
2. Click **Reports** (`/reports`):
   - Show the Executive Audit Summary findings.
   - Click **"Export Full Audit Report (CSV)"** $\to$ A compliant RFC 4180 CSV file downloads immediately.

---

## 🏆 Key Talking Points for Presentation / Defense

1. **Decoupled Architecture:** Defensive SOC platform and target web app operate completely independently with separate ports and databases/table namespaces.
2. **Zero Overhead on Target App:** Telemetry uses non-blocking HTTP streaming with in-memory buffering; if WebSentinel is offline, attendance marking never fails.
3. **Privacy First (Zero Plain Secrets):** Passwords and tokens are deeply and recursively scrubbed before leaving the target application.
4. **Deterministic & Explainable:** Threat detection uses transparent rules and mathematical risk scoring rather than opaque black-box scoring.
5. **Full Test Verification:** 66 out of 66 automated tests passing across 10 test suites covering unit logic, RBAC, DB transactions, detection rules, and incident correlation.
