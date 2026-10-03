// ============================================================================
// LABGUARD V2 — PHASE 13: LAB SESSION SYSTEM TEST SUITE
// Tests:
// 1. Session Lifecycle State Machine (Validate -> Start -> Heartbeat -> End)
// 2. Duplicate Session Prevention (Student cannot start 2 sessions)
// 3. Workstation Collision Prevention (Workstation cannot host 2 sessions)
// 4. Workstation Operational State Guard (MAINTENANCE / DISABLED blocking)
// 5. Active Session Heartbeat & Keep-Alive Telemetry
// 6. Session Cancellation & Workstation State Reset
// 7. Multi-Role Session Force-Termination (Admin/Faculty/Assistant vs Student)
// 8. Role-Scoped Session Listing & Status Filtering
// ============================================================================

const http = require('http');

const PORT = 5000;

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: json, rawBody: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: null, rawBody: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n============================================================');
  console.log('LABGUARD V2 — PHASE 13: LAB SESSION SYSTEM TEST SUITE');
  console.log('============================================================\n');

  // Start backend in-process by loading compiled server
  const { server } = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/dist/backend/src/server.js');
  await new Promise((resolve) => {
    server.listen(PORT, resolve);
  });
  console.log(`Backend test server listening on port ${PORT}.\n`);

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Authentication & Setup
    // ------------------------------------------------------------------------
    console.log('--- SECTION 1: Multi-Role Authentication Setup ---');
    // Admin login
    const admLogin = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      identifier: 'admin@labguard.edu',
      password: 'Admin@123456',
      role: 'ADMIN'
    });
    assert(admLogin.status === 200, 'Admin logs in successfully');
    const adminToken = admLogin.body?.data?.accessToken;

    // Student 1 login
    const stu1Login = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      identifier: 'student@labguard.edu',
      password: 'Student@123456',
      role: 'STUDENT'
    });
    assert(stu1Login.status === 200, 'Student 1 logs in successfully');
    const stu1Token = stu1Login.body?.data?.accessToken;
    const stu1User = stu1Login.body?.data?.user;

    // Student 2 login or provision
    let stu2Token = null;
    const stu2Login = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      identifier: 'student2@labguard.edu',
      password: 'Student@123456',
      role: 'STUDENT'
    });

    if (stu2Login.status === 200) {
      stu2Token = stu2Login.body?.data?.accessToken;
    } else {
      await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/admin/users',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      }, {
        email: 'student2@labguard.edu',
        password: 'Student@123456',
        fullName: 'Jane Student',
        role: 'STUDENT',
        identifier: 'STU-2026-002',
        department: 'Computer Science & Engineering'
      });
      const retryLogin = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        identifier: 'student2@labguard.edu',
        password: 'Student@123456',
        role: 'STUDENT'
      });
      stu2Token = retryLogin.body?.data?.accessToken;
    }
    assert(!!stu2Token, 'Student 2 logs in successfully');

    const astLogin = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      identifier: 'assistant@labguard.edu',
      password: 'Assistant@123456',
      role: 'LAB_ASSISTANT'
    });
    assert(astLogin.status === 200, 'Lab Assistant logs in successfully');
    const astToken = astLogin.body?.data?.accessToken;

    const facLogin = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      identifier: 'faculty@labguard.edu',
      password: 'Faculty@123456',
      role: 'FACULTY'
    });
    assert(facLogin.status === 200, 'Faculty logs in successfully');
    const facToken = facLogin.body?.data?.accessToken;

    // Clean up any lingering active sessions for testing clean state
    const currentSessions = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    for (const s of currentSessions.body?.data || []) {
      if (s.status === 'ACTIVE') {
        await request({
          hostname: 'localhost',
          port: PORT,
          path: `/api/sessions/${s.id}/end`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`
          }
        }, {});
      }
    }

    // ------------------------------------------------------------------------
    // SECTION 2: Pre-Flight Validation State Machine
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Pre-Flight Session Validation ---');
    const validPre = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions/validate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu1Token}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-01'
    });
    assert(validPre.status === 200, 'POST /api/sessions/validate returns HTTP 200 for available workstation');
    assert(validPre.body?.data?.allowed === true, 'Pre-flight validation approves session start');
    assert(!!validPre.body?.data?.workstation, 'Pre-flight returns target workstation object');
    assert(Array.isArray(validPre.body?.data?.attachedEquipment), 'Pre-flight returns attached peripherals');

    // Reject non-existent PC
    const nonExistPre = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions/validate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu1Token}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-NONEXISTENT'
    });
    assert(nonExistPre.status === 404, 'Pre-flight rejects unregistered PC with HTTP 404');
    assert(nonExistPre.body?.error === 'PC_NOT_FOUND', 'Error code is PC_NOT_FOUND');

    // Reject PC in MAINTENANCE mode
    // Put PC-03 in MAINTENANCE via Assistant
    await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers/pc-03/state',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, { state: 'MAINTENANCE' });

    const maintPre = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions/validate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu1Token}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-03'
    });
    assert(maintPre.status === 403, 'Pre-flight rejects MAINTENANCE workstation with HTTP 403');
    assert(maintPre.body?.error === 'COMPUTER_UNAVAILABLE', 'Error code is COMPUTER_UNAVAILABLE');

    // Restore PC-03 to AVAILABLE
    await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers/pc-03/state',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, { state: 'AVAILABLE' });

    // ------------------------------------------------------------------------
    // SECTION 3: Session Initialization & Workstation State Transition
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Session Start & Workstation Auto-Transition ---');
    const startRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions/start',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu1Token}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-01'
    });
    assert(startRes.status === 201, 'Student 1 starts session on LAB-01/PC-01 (HTTP 201)');
    assert(startRes.body?.data?.status === 'ACTIVE', 'Session status is ACTIVE');
    const session1Id = startRes.body?.data?.id;
    assert(!!session1Id, 'Session ID generated');

    // Verify PC-01 state auto-transitioned to IN_USE
    const checkPc = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers/pc-01',
      method: 'GET',
      headers: { Authorization: `Bearer ${stu1Token}` }
    });
    assert(checkPc.body?.data?.state === 'IN_USE', 'Workstation PC-01 automatically marked IN_USE');

    // ------------------------------------------------------------------------
    // SECTION 4: Duplicate Session Prevention (Student & Workstation)
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Duplicate Session Collision Prevention ---');
    // 1. Student 1 attempts to start a second session on PC-02 -> Blocked
    const dupStudent = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions/start',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu1Token}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-02'
    });
    assert(dupStudent.status === 409, 'Student 1 blocked from starting second concurrent session (HTTP 409)');
    assert(dupStudent.body?.error === 'ACTIVE_SESSION_EXISTS', 'Error code is ACTIVE_SESSION_EXISTS');

    // 2. Student 2 attempts to start on already occupied PC-01 -> Blocked
    const dupWorkstation = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions/start',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu2Token}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-01'
    });
    assert(dupWorkstation.status === 409, 'Student 2 blocked from occupying in-use workstation (HTTP 409)');
    assert(dupWorkstation.body?.error === 'COMPUTER_OCCUPIED', 'Error code is COMPUTER_OCCUPIED');

    // ------------------------------------------------------------------------
    // SECTION 5: Active Session Telemetry & Heartbeat Keep-Alive
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Active Session Telemetry & Heartbeats ---');
    const activeList = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions/active',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(activeList.status === 200, 'GET /api/sessions/active returns HTTP 200');
    assert(activeList.body?.data?.count >= 1, 'Active session count is at least 1');
    const hasSession1 = (activeList.body?.data?.activeSessions || []).some((s) => s.id === session1Id);
    assert(hasSession1, 'Active sessions list contains Session 1');

    // Session Heartbeat
    const beatRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/sessions/${session1Id}/heartbeat`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu1Token}`
      }
    }, {});
    assert(beatRes.status === 200, 'Session heartbeat accepted (HTTP 200)');
    assert(beatRes.body?.data?.status === 'ACTIVE', 'Heartbeat confirms session is ACTIVE');
    assert(typeof beatRes.body?.data?.elapsedMinutes === 'number', 'Heartbeat returns elapsedMinutes');

    // Student 2 cannot heartbeat Student 1 session
    const illegalBeat = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/sessions/${session1Id}/heartbeat`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu2Token}`
      }
    }, {});
    assert(illegalBeat.status === 403, 'Student 2 cannot heartbeat Student 1 session (HTTP 403 Forbidden)');

    // Inspect session by ID
    const getSess = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/sessions/${session1Id}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${stu1Token}` }
    });
    assert(getSess.status === 200, 'GET /api/sessions/:id returns session details (HTTP 200)');
    assert(getSess.body?.data?.session?.id === session1Id, 'Returned session ID matches');
    assert(!!getSess.body?.data?.workstation, 'Returned payload includes attached workstation node');
    assert(Array.isArray(getSess.body?.data?.attachedEquipment), 'Returned payload includes attached peripherals');

    // ------------------------------------------------------------------------
    // SECTION 6: Session Cancellation Workflow
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Session Cancellation ---');
    // Start session for Student 2 on PC-02
    const startSess2 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions/start',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu2Token}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-02'
    });
    assert(startSess2.status === 201, 'Student 2 starts session on PC-02');
    const session2Id = startSess2.body?.data?.id;

    // Student 2 cancels session
    const cancelRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/sessions/${session2Id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu2Token}`
      }
    }, {});
    assert(cancelRes.status === 200, 'Student 2 cancels session (HTTP 200)');
    assert(cancelRes.body?.data?.status === 'CANCELLED', 'Session status set to CANCELLED');

    // Workstation PC-02 returned to AVAILABLE
    const pc02Check = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers/pc-02',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pc02Check.body?.data?.state === 'AVAILABLE', 'Workstation PC-02 automatically restored to AVAILABLE');

    // ------------------------------------------------------------------------
    // SECTION 7: Multi-Role Session Force-Termination
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 7: Administrative Force-Termination ---');
    // Student cannot force-end
    const stuForce = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/sessions/${session1Id}/force-end`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu2Token}`
      }
    }, { reason: 'Unauthorized prank' });
    assert(stuForce.status === 403, 'Student cannot force-end sessions (HTTP 403 Forbidden)');

    // Lab Assistant force-ends Student 1 session
    const astForce = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/sessions/${session1Id}/force-end`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, { reason: 'Lab closing for maintenance' });
    assert(astForce.status === 200, 'Lab Assistant force-terminates session (HTTP 200)');
    assert(astForce.body?.data?.status === 'FORCED_END', 'Session status marked FORCED_END');
    assert(astForce.body?.data?.endMode === 'FORCED_END', 'Session endMode marked FORCED_END');

    // Workstation PC-01 restored to AVAILABLE
    const pc01Check = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers/pc-01',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pc01Check.body?.data?.state === 'AVAILABLE', 'Workstation PC-01 restored to AVAILABLE after force-end');

    // ------------------------------------------------------------------------
    // SECTION 8: Normal Session End & Status Filtering
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 8: Normal Session End & Scoped Status Filters ---');
    // Start fresh session for Student 1 on PC-01
    const freshStart = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions/start',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu1Token}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-01'
    });
    assert(freshStart.status === 201, 'Student 1 starts fresh session');
    const freshId = freshStart.body?.data?.id;

    // Normal end
    const normEnd = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/sessions/${freshId}/end`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu1Token}`
      }
    }, { endMode: 'NORMAL' });
    assert(normEnd.status === 200, 'Student 1 ends session normally (HTTP 200)');
    assert(normEnd.body?.data?.status === 'COMPLETED', 'Session marked COMPLETED');

    // Query sessions with status filter ?status=COMPLETED
    const completedList = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions?status=COMPLETED',
      method: 'GET',
      headers: { Authorization: `Bearer ${stu1Token}` }
    });
    assert(completedList.status === 200, 'GET /api/sessions?status=COMPLETED returns HTTP 200');
    const allCompleted = (completedList.body?.data || []).every((s) => s.status === 'COMPLETED');
    assert(allCompleted, 'All returned sessions have COMPLETED status');

    console.log('\n============================================================');
    console.log(`PHASE 13 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    server.close();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
