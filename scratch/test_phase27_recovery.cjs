// ============================================================================
// LABGUARD V2 - Phase 27: Crash Recovery Automated Test Suite
// Verifies detection of abnormal shutdowns, local SQLite session recovery,
// central server /api/sessions/recover endpoint, automatic stale session reconciliation,
// workstation state restoration (to AVAILABLE), and zero duplicate session deadlocks.
// ============================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] Test ${totalTests}: ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] Test ${totalTests}: ${message}`);
    if (arguments.length > 2 && arguments[2] !== undefined) {
      console.error('         Context:', JSON.stringify(arguments[2]));
    }
    process.exitCode = 1;
  }
}

console.log('\n======================================================');
console.log('LABGUARD V2: PHASE 27 CRASH RECOVERY VERIFICATION');
console.log('======================================================\n');

// Import compiled backend app
const { app } = require('../backend/dist/backend/src/server.js');
const { LocalDbService } = require('./localDb.cjs');

const TEST_PORT = 5006;
let server;

function makeRequest(method, pathUrl, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const body = data ? JSON.stringify(data) : null;
    if (body) headers['Content-Length'] = Buffer.byteLength(body);

    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: pathUrl,
        method,
        headers
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTests() {
  server = app.listen(TEST_PORT, async () => {
    console.log(`[CrashRecoveryTest] Test server mounted on port ${TEST_PORT}\n`);

    try {
      // ------------------------------------------------------------------------
      // SECTION 1: Authentication & User Setup
      // ------------------------------------------------------------------------
      console.log('--- SECTION 1: Authentication & User Setup ---');

      const adminLogin = await makeRequest('POST', '/api/auth/login', {
        identifier: 'admin@labguard.edu',
        password: 'Admin@123456',
        targetRole: 'ADMIN'
      });
      assert(adminLogin.status === 200 && adminLogin.body.success, 'Admin login succeeds');
      const adminToken = adminLogin.body.data.accessToken;

      const studentLogin = await makeRequest('POST', '/api/auth/login', {
        identifier: 'student@labguard.edu',
        password: 'Student@123456',
        targetRole: 'STUDENT'
      });
      assert(studentLogin.status === 200 && studentLogin.body.success, 'Student login succeeds');
      const studentToken = studentLogin.body.data.accessToken;
      const studentId = studentLogin.body.data.user.id;

      // ------------------------------------------------------------------------
      // SECTION 2: Local SQLite Crash Recovery Engine (localDb.cjs / localDb.ts)
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 2: Local SQLite Crash Recovery Engine ---');

      await LocalDbService.init();

      // Simulate an unclosed active session before crash
      const activeSession = await LocalDbService.startLocalSession({
        studentId: 'stu-crash-test-01',
        studentName: 'Alex Mercer',
        studentIdentifier: 'STU-2026-CRASH',
        labCode: 'LAB-01',
        pcCode: 'PC-CRASH-01'
      });

      assert(activeSession && activeSession.status === 'ACTIVE', 'Simulated active session successfully created before crash');

      // Verify workstation is IN_USE
      const pcBeforeRecovery = await LocalDbService.getLocalComputers('LAB-01');
      const crashPc = pcBeforeRecovery.find(p => p.pc_code === 'PC-CRASH-01');
      assert(crashPc && crashPc.state === 'IN_USE', 'Workstation PC-CRASH-01 was placed in IN_USE state');

      // Check getActiveLocalSession finds it
      const foundActive = await LocalDbService.getActiveLocalSession('stu-crash-test-01');
      assert(foundActive && foundActive.id === activeSession.id, 'Active session is discoverable in SQLite');

      // Run Crash Recovery
      const recoveryResult = await LocalDbService.recoverOrphanedLocalSessions('Sudden power loss simulation');
      assert(recoveryResult.recoveredCount >= 1, 'recoverOrphanedLocalSessions detects and processes orphaned active session(s)');

      const recoveredSession = recoveryResult.recoveredSessions.find(s => s.id === activeSession.id);
      assert(recoveredSession && recoveredSession.status === 'RECOVERED', 'Session status is transitioned to RECOVERED');
      assert(recoveredSession && recoveredSession.end_mode === 'CRASH_RECOVERED', 'Session end_mode is set to CRASH_RECOVERED');
      assert(!!recoveredSession.ended_at, 'Recovery timestamp ended_at is recorded');

      // Verify workstation state restored to AVAILABLE
      const pcAfterRecovery = await LocalDbService.getLocalComputers('LAB-01');
      const restoredPc = pcAfterRecovery.find(p => p.pc_code === 'PC-CRASH-01');
      assert(restoredPc && restoredPc.state === 'AVAILABLE', 'Workstation PC-CRASH-01 state restored back to AVAILABLE');

      // Verify getActiveLocalSession returns null (clean slate)
      const afterActive = await LocalDbService.getActiveLocalSession('stu-crash-test-01');
      assert(afterActive === null, 'No lingering active session remains for student');

      // Verify sync_queue contains recovery entry
      const syncItems = await LocalDbService.getPendingSyncItems();
      const recoverSyncItem = syncItems.find(item => {
        if (item.entity_id !== activeSession.id) return false;
        try {
          const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
          return payload && (payload.action === 'RECOVER' || payload.end_mode === 'CRASH_RECOVERED');
        } catch {
          return false;
        }
      });
      assert(!!recoverSyncItem, 'Crash recovery event enqueued in sync_queue for central synchronization', syncItems);

      // ------------------------------------------------------------------------
      // SECTION 3: Central Server Crash Recovery Endpoint (/api/sessions/recover)
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 3: Central Server Crash Recovery Endpoint ---');

      // Student starts a session on PC-02
      const startRes = await makeRequest('POST', '/api/sessions/start', {
        labCode: 'LAB-01',
        pcCode: 'PC-02'
      }, studentToken);
      assert((startRes.status === 200 || startRes.status === 201) && startRes.body.success, 'Student session started on PC-02', startRes);
      const serverSessionId = startRes.body && startRes.body.data ? startRes.body.data.id : null;

      // Verify workstation is IN_USE
      const pcRes1 = await makeRequest('GET', '/api/computers', null, adminToken);
      const pc02Before = pcRes1.body && pcRes1.body.data ? pcRes1.body.data.find(p => p.pcCode === 'PC-02') : null;
      assert(pc02Before && pc02Before.state === 'IN_USE', 'Server marks PC-02 as IN_USE', pcRes1.body);

      // Invoke server-side crash recovery for PC-02
      const recoverRes = await makeRequest('POST', '/api/sessions/recover', {
        labCode: 'LAB-01',
        pcCode: 'PC-02',
        reason: 'Workstation abnormal reboot detected'
      }, adminToken);

      assert(recoverRes.status === 200 && recoverRes.body.success, 'POST /api/sessions/recover returns HTTP 200', recoverRes);
      assert(recoverRes.body && recoverRes.body.recoveredCount >= 1, 'Server recovery reports at least 1 session recovered', recoverRes.body);

      const serverRecoveredSess = recoverRes.body && recoverRes.body.data ? recoverRes.body.data.find(s => s.id === serverSessionId) : null;
      assert(serverRecoveredSess && serverRecoveredSess.status === 'RECOVERED', 'Server session status updated to RECOVERED');
      assert(serverRecoveredSess && serverRecoveredSess.endMode === 'CRASH_RECOVERED', 'Server session endMode updated to CRASH_RECOVERED');

      // Verify server workstation restored to AVAILABLE
      const pcRes2 = await makeRequest('GET', '/api/computers', null, adminToken);
      const pc02After = pcRes2.body && pcRes2.body.data ? pcRes2.body.data.find(p => p.pcCode === 'PC-02') : null;
      assert(pc02After && pc02After.state === 'AVAILABLE', 'Server workstation PC-02 restored to AVAILABLE', pcRes2.body);

      // ------------------------------------------------------------------------
      // SECTION 4: Auto-Recovery on Re-login (Preventing Duplicate Lockout)
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 4: Auto-Recovery on Re-login ---');

      // Student starts a session on PC-03
      const startPc3 = await makeRequest('POST', '/api/sessions/start', {
        labCode: 'LAB-01',
        pcCode: 'PC-03'
      }, studentToken);
      assert((startPc3.status === 200 || startPc3.status === 201) && startPc3.body.success, 'Student starts session on PC-03', startPc3);

      // Student attempts to validate pre-session on SAME workstation PC-03 (simulating relaunch after crash)
      const revalidateSamePc = await makeRequest('POST', '/api/sessions/validate', {
        labCode: 'LAB-01',
        pcCode: 'PC-03'
      }, studentToken);
      assert(revalidateSamePc.status === 200 && revalidateSamePc.body.success, 'Pre-session validation on same PC auto-recovers orphaned session without 409 conflict', revalidateSamePc);

      // Student starts new session on PC-03
      const restartPc3 = await makeRequest('POST', '/api/sessions/start', {
        labCode: 'LAB-01',
        pcCode: 'PC-03'
      }, studentToken);
      assert((restartPc3.status === 200 || restartPc3.status === 201) && restartPc3.body.success, 'New session starts cleanly without duplicate session deadlock', restartPc3);

      // Clean up session
      await makeRequest('POST', '/api/sessions/end', {
        sessionId: restartPc3.body.data.id
      }, studentToken);

      // ------------------------------------------------------------------------
      // SECTION 5: Native Crash Sentinel Architecture
      // ------------------------------------------------------------------------
      console.log('\n--- SECTION 5: Native Crash Sentinel Architecture ---');

      const mainRsPath = path.resolve(__dirname, '../desktop/src-tauri/src/main.rs');
      const mainRsContent = fs.readFileSync(mainRsPath, 'utf-8');
      assert(mainRsContent.includes('set_session_sentinel'), 'main.rs implements set_session_sentinel command');
      assert(mainRsContent.includes('check_session_sentinel'), 'main.rs implements check_session_sentinel command');
      assert(mainRsContent.includes('SessionSentinel'), 'main.rs defines SessionSentinel structure');
      assert(mainRsContent.includes('abnormal_termination'), 'SessionSentinel tracks abnormal_termination flag');

      const nativeTsPath = path.resolve(__dirname, '../desktop/src/services/native.ts');
      const nativeTsContent = fs.readFileSync(nativeTsPath, 'utf-8');
      assert(nativeTsContent.includes('setSessionSentinel'), 'native.ts exposes setSessionSentinel wrapper');
      assert(nativeTsContent.includes('checkSessionSentinel'), 'native.ts exposes checkSessionSentinel wrapper');

      const startupTsPath = path.resolve(__dirname, '../desktop/src/services/startupSequence.ts');
      const startupTsContent = fs.readFileSync(startupTsPath, 'utf-8');
      assert(startupTsContent.includes('recoverOrphanedLocalSessions'), 'startupSequence.ts integrates crash recovery during boot sequence');

      // ------------------------------------------------------------------------
      // Summary
      // ------------------------------------------------------------------------
      console.log(`\n======================================================`);
      console.log(`PHASE 27 TESTS COMPLETE: ${passedTests}/${totalTests} PASSED`);
      console.log(`======================================================\n`);

      server.close();
      if (passedTests === totalTests) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    } catch (err) {
      console.error('[CrashRecoveryTest] Unexpected error:', err);
      server.close();
      process.exit(1);
    }
  });
}

runTests();
