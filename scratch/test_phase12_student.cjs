// ============================================================================
// LABGUARD V2 — PHASE 12: STUDENT MODULE VERIFICATION TEST SUITE
// Tests:
// 1. Student Authentication & Profile Integrity
// 2. Student Dashboard (Personalized Session, Workstation, Peripherals)
// 3. Peripheral Accountability & Workstation Inspection
// 4. Strict Student Data Isolation (Cannot see other students' sessions or issues)
// 5. Issue Reporting & Resolution Tracking
// 6. Session Lifecycle (Start, Active check, Completion)
// 7. Anti-Escalation RBAC Boundary Tests (Zero Administrative Escalation)
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
  console.log('LABGUARD V2 — PHASE 12: STUDENT MODULE TEST SUITE');
  console.log('============================================================\n');

  // Start backend in-process by loading compiled server
  const { server } = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/dist/backend/src/server.js');
  await new Promise((resolve) => {
    server.listen(PORT, resolve);
  });
  console.log(`Backend test server listening on port ${PORT}.\n`);

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Authentication & Identity
    // ------------------------------------------------------------------------
    console.log('--- SECTION 1: Authentication & Identity ---');
    const stuLogin = await request({
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

    assert(stuLogin.status === 200, 'Student logs in successfully with HTTP 200');
    assert(!!stuLogin.body?.data?.accessToken, 'Student receives valid JWT access token');
    const stuToken = stuLogin.body?.data?.accessToken;
    const stuUser = stuLogin.body?.data?.user;
    assert(stuUser?.role === 'STUDENT', 'User role is verified as STUDENT');

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
    assert(admLogin.status === 200, 'Administrator logs in successfully');
    const adminToken = admLogin.body?.data?.accessToken;

    // Faculty login
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

    // Second student login
    let stu2Token = null;
    let stu2User = null;
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
      stu2User = stu2Login.body?.data?.user;
    } else {
      // Create student2 via admin
      const createStu2 = await request({
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
      if (createStu2.status === 201) {
        stu2User = createStu2.body.data;
        const s2Login = await request({
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
        stu2Token = s2Login.body?.data?.accessToken;
      }
    }
    assert(!!stu2Token, 'Secondary student account ready for cross-student isolation tests');

    // ------------------------------------------------------------------------
    // SECTION 2: Student Dashboard
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Student Dashboard API ---');
    const stuDash = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/student/dashboard',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });

    assert(stuDash.status === 200, 'GET /api/student/dashboard returns HTTP 200 for Student');
    assert(stuDash.body?.success === true, 'Dashboard payload contains success: true');
    assert(!!stuDash.body?.data?.profile, 'Dashboard includes student academic profile');
    assert(stuDash.body?.data?.profile?.department === 'Computer Science & Engineering', 'Profile department is accurate');
    assert(Array.isArray(stuDash.body?.data?.recentIssues), 'Dashboard returns recent issues list');
    assert(Array.isArray(stuDash.body?.data?.sessionHistory), 'Dashboard returns session history array');

    // Faculty cannot access student dashboard
    const facDash = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/student/dashboard',
      method: 'GET',
      headers: { Authorization: `Bearer ${facToken}` }
    });
    assert(facDash.status === 403, 'Faculty cannot access student dashboard (HTTP 403 Forbidden)');

    // ------------------------------------------------------------------------
    // SECTION 3: Workstation & Peripheral Inspection
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Workstation & Equipment Accountability ---');
    const compRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(compRes.status === 200, 'Student can query workstation fleet (GET /api/computers)');
    assert(Array.isArray(compRes.body?.data), 'Workstation list is an array');

    const equipRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/equipment',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(equipRes.status === 200, 'Student can query peripheral equipment (GET /api/equipment)');
    assert(Array.isArray(equipRes.body?.data), 'Equipment list is an array');

    // Student cannot create or modify computers
    const addComp = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, {
      labId: 'lab-01',
      hostname: 'ILLEGAL-PC',
      ipAddress: '192.168.1.99',
      macAddress: '00:11:22:33:44:55'
    });
    assert(addComp.status === 403, 'Student cannot add computers (HTTP 403 Forbidden)');

    // Student cannot create equipment
    const addEquip = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/equipment',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, {
      name: 'Rogue Mouse',
      type: 'MOUSE',
      serialNumber: 'ROGUE-01'
    });
    assert(addEquip.status === 403, 'Student cannot add equipment (HTTP 403 Forbidden)');

    // ------------------------------------------------------------------------
    // SECTION 4: Personal Session Lifecycle
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Personal Session Lifecycle ---');
    // Ensure any open session for student 1 is ended
    const initialSessions = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    const existingActive = (initialSessions.body?.data || []).find((s) => s.status === 'ACTIVE');
    if (existingActive) {
      await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/sessions/${existingActive.id}/end`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${stuToken}`
        }
      }, {});
    }

    // Start a fresh session for student
    const startSess = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions/start',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, {
      computerId: 'pc-01',
      sessionType: 'PRACTICE'
    });
    assert(startSess.status === 201 || startSess.status === 200, 'Student starts session successfully');
    const sessionId = startSess.body?.data?.id || startSess.body?.data?.session?.id;
    assert(!!sessionId, 'Active session ID generated');

    // Verify dashboard reflects active session and workstation equipment
    const activeDash = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/student/dashboard',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(activeDash.status === 200, 'Dashboard loaded during active session');
    assert(
      activeDash.body?.data?.currentWorkstation?.pcCode?.toUpperCase() === 'PC-01' ||
      activeDash.body?.data?.currentWorkstation?.id === 'pc-01',
      'Dashboard resolves active workstation PC-01'
    );
    assert(Array.isArray(activeDash.body?.data?.workstationEquipment), 'Dashboard resolves attached peripherals');

    // ------------------------------------------------------------------------
    // SECTION 5: Strict Student Data Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Strict Student Data Isolation ---');
    const stu1Sessions = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    const allBelongToStu1 = (stu1Sessions.body?.data || []).every((s) => s.studentId === stuUser.id);
    assert(allBelongToStu1, 'Student 1 only receives their own session history');

    const stu2Sessions = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions',
      method: 'GET',
      headers: { Authorization: `Bearer ${stu2Token}` }
    });
    const stu2SeesStu1Session = (stu2Sessions.body?.data || []).some((s) => s.id === sessionId);
    assert(!stu2SeesStu1Session, 'Student 2 cannot see Student 1 active session in history');

    const illegalEnd = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/sessions/${sessionId}/end`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stu2Token}`
      }
    }, {});
    assert(illegalEnd.status === 403 || illegalEnd.status === 404, 'Student 2 cannot terminate Student 1 session (HTTP 403/404)');

    // ------------------------------------------------------------------------
    // SECTION 6: Issue Reporting & Student Queue Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Issue Reporting & Tracking ---');
    const newIssue = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/issues',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, {
      computerId: 'pc-01',
      equipmentId: 'eq-kb-01',
      title: 'Sticky Spacebar Key',
      description: 'The spacebar key occasionally misses input during typing.',
      severity: 'LOW',
      category: 'KEYBOARD'
    });
    assert(newIssue.status === 201 || newIssue.status === 200, 'Student submits issue report successfully');
    const issueId = newIssue.body?.data?.id;
    assert(!!issueId, 'Issue ID assigned');

    // Student 1 checks issues
    const stu1Issues = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/issues',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(stu1Issues.status === 200, 'Student queries personal issues');
    const hasReportedIssue = (stu1Issues.body?.data || []).some((i) => i.id === issueId);
    assert(hasReportedIssue, 'Reported issue present in Student 1 issue list');

    // Student 2 checks issues -> cannot see Student 1's issue
    const stu2Issues = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/issues',
      method: 'GET',
      headers: { Authorization: `Bearer ${stu2Token}` }
    });
    const stu2HasStu1Issue = (stu2Issues.body?.data || []).some((i) => i.id === issueId);
    assert(!stu2HasStu1Issue, 'Student 2 cannot see issues reported by Student 1');

    // Clean up: Student ends their own session
    const endSess = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/sessions/${sessionId}/end`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, {});
    assert(endSess.status === 200, 'Student can end their own active session');
    assert(endSess.body?.data?.status === 'COMPLETED', 'Session marked as COMPLETED');

    // ------------------------------------------------------------------------
    // SECTION 7: Anti-Escalation RBAC Boundary Tests
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 7: Anti-Escalation RBAC Boundary Tests ---');
    const rbac1 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/users',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(rbac1.status === 403, 'Student cannot list users (HTTP 403 Forbidden)');

    const rbac2 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, { email: 'hacker@labguard.edu' });
    assert(rbac2.status === 403, 'Student cannot create users (HTTP 403 Forbidden)');

    const rbac3 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/labs/lab-01',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(rbac3.status === 403, 'Student cannot delete labs (HTTP 403 Forbidden)');

    const rbac4 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(rbac4.status === 403, 'Student cannot access audit logs (HTTP 403 Forbidden)');

    const rbac5 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/faculty/assignments',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, { title: 'Test' });
    assert(rbac5.status === 403, 'Student cannot create faculty assignments (HTTP 403 Forbidden)');

    const rbac6 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/assistant/telemetry/event',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, { eventType: 'SPOOF' });
    assert(rbac6.status === 403, 'Student cannot post assistant telemetry (HTTP 403 Forbidden)');

    console.log('\n============================================================');
    console.log(`PHASE 12 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    server.close();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
