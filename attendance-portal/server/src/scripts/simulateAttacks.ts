/**
 * End-to-End Attack Simulation & SOC Ingestion Verification Script
 *
 * Dispatches simulated attack vectors to the Student Attendance Portal (Port 5000),
 * flushes telemetry to WebSentinel Ingestion Pipeline (Port 4000),
 * executes the Detection Engine and Correlation Engine, and outputs verification results.
 */
import { signJwt } from '../utils/jwt.js';
import { env } from '../config/env.js';

const PORTAL_URL = 'http://localhost:5000';
const WEBSENTINEL_URL = 'http://localhost:4000';

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSimulation() {
  console.log('===============================================================');
  console.log('🛡️  WebSentinel <-> Attendance Portal End-to-End Attack Simulation');
  console.log('===============================================================\n');

  // Verify health of both backends
  console.log('🔍 Checking target application and SOC platform status...');
  try {
    const portalHealth = (await fetch(`${PORTAL_URL}/api/health`).then((r) => r.json())) as any;
    console.log(`✅ Attendance Portal API is ONLINE: ${portalHealth.service} (${portalHealth.environment})`);
  } catch (err: any) {
    console.warn(`⚠️ Attendance Portal API not reachable on ${PORTAL_URL}: ${err.message}`);
    console.warn('   (Ensure "npm run portal:server:dev" is running)');
  }

  try {
    const socHealth = (await fetch(`${WEBSENTINEL_URL}/api/health`).then((r) => r.json())) as any;
    console.log(`✅ WebSentinel SOC Platform is ONLINE: ${socHealth.service} (${socHealth.environment})`);
  } catch (err: any) {
    console.warn(`⚠️ WebSentinel API not reachable on ${WEBSENTINEL_URL}: ${err.message}`);
    console.warn('   (Ensure "npm run server:dev" is running)');
  }

  console.log('\n--- 1. Executing Attack Vector 1: SQL Injection Probe ---');
  try {
    const res = await fetch(`${PORTAL_URL}/api/courses/search?q=' OR '1'='1 -- UNION SELECT NULL`);
    console.log(`   Dispatched GET /api/courses/search -> Status: ${res.status}`);
    console.log('   Expected Rule: RULE-006 (SQL Injection Attack Attempt)');
  } catch (err: any) {
    console.log(`   Request error: ${err.message}`);
  }

  console.log('\n--- 2. Executing Attack Vector 2: Reconnaissance Scanner ---');
  const reconPaths = ['/.env', '/wp-login.php', '/actuator/health', '/.git/config'];
  for (const p of reconPaths) {
    try {
      const res = await fetch(`${PORTAL_URL}${p}`);
      console.log(`   Dispatched GET ${p} -> Status: ${res.status}`);
    } catch (err: any) {
      console.log(`   Request error on ${p}: ${err.message}`);
    }
  }
  console.log('   Expected Rule: RULE-005 (Unmapped Reconnaissance Scanning Probe)');

  console.log('\n--- 3. Executing Attack Vector 3: Credential Stuffing / Brute Force Burst ---');
  for (let i = 1; i <= 6; i++) {
    try {
      const res = await fetch(`${PORTAL_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'target.student@portal.edu',
          password: `AttackerGuess_${i}!`,
        }),
      });
      console.log(`   Attempt #${i}: POST /api/auth/login -> Status: ${res.status}`);
    } catch (err: any) {
      console.log(`   Attempt #${i} error: ${err.message}`);
    }
  }
  console.log('   Expected Rule: RULE-001 / RULE-002 (Authentication Brute Force Burst)');

  console.log('\n--- 4. Executing Attack Vector 4: Privilege Escalation Attempt ---');
  const studentToken = signJwt(
    {
      id: 'usr-student-001',
      name: 'Alice Johnson',
      email: 'student@portal.edu',
      role: 'student',
    },
    env.JWT_SECRET,
    1
  );

  try {
    const res = await fetch(`${PORTAL_URL}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    console.log(`   Dispatched GET /api/admin/audit-logs with Student Token -> Status: ${res.status}`);
    console.log('   Expected Rule: RULE-003 (High Privilege Escalation Attempt)');
  } catch (err: any) {
    console.log(`   Request error: ${err.message}`);
  }

  console.log('\n--- 5. Executing Attack Vector 5: Attendance Data Tampering Burst ---');
  const teacherToken = signJwt(
    {
      id: 'usr-teacher-001',
      name: 'Prof. Alan Turing',
      email: 'teacher@portal.edu',
      role: 'teacher',
    },
    env.JWT_SECRET,
    1
  );

  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(`${PORTAL_URL}/api/attendance/bulk-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-simulate-attack': 'tampering',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          updates: [
            { recordId: 'att-001', status: 'present' },
            { recordId: 'att-002', status: 'late' },
          ],
        }),
      });
      console.log(`   Tamper request #${i + 1}: POST /api/attendance/bulk-update -> Status: ${res.status}`);
    } catch (err: any) {
      console.log(`   Tamper request #${i + 1} error: ${err.message}`);
    }
  }
  console.log('   Expected Rule: RULE-004 (Attendance Data Tampering Burst)');

  console.log('\n⏳ Waiting 3 seconds for asynchronous logger batch flushes to WebSentinel...');
  await wait(3000);

  // Trigger SOC Detection & Correlation
  console.log('\n--- 6. Running WebSentinel SOC Detection & Correlation Pipeline ---');
  try {
    const detectRes = await fetch(`${WEBSENTINEL_URL}/api/detection/run`, { method: 'POST' });
    if (detectRes.ok) {
      const detectData = (await detectRes.json()) as any;
      console.log(`⚡ Detection Engine Run Completed: Generated ${detectData?.data?.alertsGenerated || 0} Alerts`);
    }

    const corrRes = await fetch(`${WEBSENTINEL_URL}/api/incidents/correlate`, { method: 'POST' });
    if (corrRes.ok) {
      const corrData = (await corrRes.json()) as any;
      console.log(`🛡️ Incident Correlation Completed: Created ${corrData?.data?.incidentsCreated || 0} Incidents`);
    }

    const incidentsRes = await fetch(`${WEBSENTINEL_URL}/api/incidents?limit=5`);
    if (incidentsRes.ok) {
      const incidentData = (await incidentsRes.json()) as any;
      const topIncidents = incidentData?.data?.incidents || [];
      console.log('\n📊 Correlated Security Incidents in SOC:');
      for (const inc of topIncidents) {
        console.log(`   • [${inc.id}] [${inc.severity.toUpperCase()}] Risk: ${inc.riskScore}/100 - ${inc.title}`);
      }
    }
  } catch (err: any) {
    console.log(`   SOC trigger notice: ${err.message}`);
  }

  console.log('\n===============================================================');
  console.log('🎉 Attack Simulation & Telemetry Ingestion Complete!');
  console.log('👉 View the live SOC Dashboard at: http://localhost:3000');
  console.log('👉 View the Attendance Portal at:  http://localhost:3001');
  console.log('===============================================================\n');
}

runSimulation();
