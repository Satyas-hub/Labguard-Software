// ============================================================================
// LABGUARD V2 — PHASE 15: ISSUE MANAGEMENT TEST SUITE
// Tests:
// 1. Issue Reporting (Severity, Categorization, Evidence Payload)
// 2. Detailed Issue Querying (Linking Workstation, Equipment, Maintenance)
// 3. Issue Lifecycle State Progression:
//    OPEN -> VERIFIED -> INVESTIGATING -> MAINTENANCE -> RESOLVED
// 4. Automated Workstation & Equipment State Coupling
// 5. Automated Linked Maintenance Work Order Generation
// 6. Evidence Attachment API
// 7. Multi-Parameter Issue Filtering (Status, Severity, Lab)
// 8. Strict Anti-Escalation RBAC & Facility Scope Enforcement
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
  console.log('LABGUARD V2 — PHASE 15: ISSUE MANAGEMENT TEST SUITE');
  console.log('============================================================\n');

  // Start backend in-process by loading compiled server
  const { server } = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/dist/backend/src/server.js');
  await new Promise((resolve) => {
    server.listen(PORT, resolve);
  });
  console.log(`Backend test server listening on port ${PORT}.\n`);

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Authentication Setup
    // ------------------------------------------------------------------------
    console.log('--- SECTION 1: Authentication Setup ---');
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
    assert(stuLogin.status === 200, 'Student logs in successfully');
    const stuToken = stuLogin.body?.data?.accessToken;

    // Student 2 for cross-student isolation tests
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
    assert(!!stu2Token, 'Student 2 ready for isolation testing');

    // ------------------------------------------------------------------------
    // SECTION 2: Issue Creation & Reporting
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Issue Reporting & Initial State ---');
    const createRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/issues',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-01',
      equipmentId: 'eq-kb-01',
      issueType: 'Keyboard Problem',
      description: 'Physical damage on keycap switch and key not responding',
      severity: 'HIGH',
      evidenceUrl: 'https://storage.labguard.edu/evidence/kb-damage-01.jpg'
    });

    assert(createRes.status === 201, 'Student reports issue successfully (HTTP 201)');
    assert(createRes.body?.data?.status === 'OPEN', 'Issue initial state is OPEN');
    assert(createRes.body?.data?.severity === 'HIGH', 'Severity is correctly set to HIGH');
    const issueId = createRes.body?.data?.id;
    assert(!!issueId, 'Unique Issue ID assigned');

    // Detailed Inspection endpoint
    const detailRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/issues/${issueId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(detailRes.status === 200, 'GET /api/issues/:id returns full issue details (HTTP 200)');
    assert(detailRes.body?.data?.issue?.id === issueId, 'Issue details match ID');
    assert(!!detailRes.body?.data?.workstation, 'Workstation node linked to issue');
    assert(Array.isArray(detailRes.body?.data?.maintenanceRecords), 'Maintenance records array linked');

    // ------------------------------------------------------------------------
    // SECTION 3: Lifecycle Progression: OPEN -> VERIFIED -> INVESTIGATING
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Lifecycle Progression (VERIFIED & INVESTIGATING) ---');
    // Assistant verifies issue
    const verifyRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/issues/${issueId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      status: 'VERIFIED',
      resolutionNotes: 'Physical switch inspected at bench by lab assistant'
    });
    assert(verifyRes.status === 200, 'Issue progressed to VERIFIED (HTTP 200)');
    assert(verifyRes.body?.data?.status === 'VERIFIED', 'Issue status is VERIFIED');
    assert(!!verifyRes.body?.data?.verifiedBy, 'verifiedBy attribution recorded');
    assert(!!verifyRes.body?.data?.verifiedAt, 'verifiedAt timestamp recorded');

    // Assistant moves to INVESTIGATING
    const investRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/issues/${issueId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      status: 'INVESTIGATING',
      resolutionNotes: 'Conducting controller firmware diagnostics'
    });
    assert(investRes.status === 200, 'Issue progressed to INVESTIGATING (HTTP 200)');
    assert(investRes.body?.data?.status === 'INVESTIGATING', 'Issue status is INVESTIGATING');

    // ------------------------------------------------------------------------
    // SECTION 4: Lifecycle Progression: INVESTIGATING -> MAINTENANCE
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Maintenance Progression & Auto-Coupling ---');
    const maintRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/issues/${issueId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      status: 'MAINTENANCE',
      resolutionNotes: 'Dispatched to technician for component replacement'
    });
    assert(maintRes.status === 200, 'Issue progressed to MAINTENANCE (HTTP 200)');
    assert(maintRes.body?.data?.status === 'MAINTENANCE', 'Issue status is MAINTENANCE');

    // Verify PC-01 automatically transitioned to MAINTENANCE
    const pcCheck = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers/pc-01',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pcCheck.body?.data?.state === 'MAINTENANCE', 'Workstation PC-01 automatically transitioned to MAINTENANCE');

    // Verify linked maintenance record was automatically generated
    const maintList = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/maintenance',
      method: 'GET',
      headers: { Authorization: `Bearer ${astToken}` }
    });
    const linkedRecord = (maintList.body?.data || []).find((m) => m.issueId === issueId);
    assert(!!linkedRecord, 'Linked MaintenanceRecord automatically created');
    assert(linkedRecord?.status === 'IN_PROGRESS', 'MaintenanceRecord status is IN_PROGRESS');

    // ------------------------------------------------------------------------
    // SECTION 5: Evidence Attachment API
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Evidence Attachment API ---');
    const attachRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/issues/${issueId}/evidence`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      evidenceUrl: 'https://storage.labguard.edu/evidence/multimeter_readings_01.pdf',
      evidenceDescription: 'Voltage test results across USB connector pins'
    });
    assert(attachRes.status === 200, 'Evidence attached successfully (HTTP 200)');
    assert(
      attachRes.body?.data?.evidenceUrl === 'https://storage.labguard.edu/evidence/multimeter_readings_01.pdf',
      'Issue evidenceUrl updated'
    );

    // ------------------------------------------------------------------------
    // SECTION 6: Lifecycle Progression: MAINTENANCE -> RESOLVED
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Resolution & Workstation Restoration ---');
    const resolveRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/issues/${issueId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      status: 'RESOLVED',
      resolutionNotes: 'Keycap and mechanical switch replaced with genuine spare. Fully operational.'
    });
    assert(resolveRes.status === 200, 'Issue marked as RESOLVED (HTTP 200)');
    assert(resolveRes.body?.data?.status === 'RESOLVED', 'Issue status is RESOLVED');
    assert(!!resolveRes.body?.data?.resolvedBy, 'resolvedBy attribution populated');
    assert(!!resolveRes.body?.data?.resolvedAt, 'resolvedAt timestamp populated');

    // Workstation PC-01 restored to AVAILABLE
    const pcRestored = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers/pc-01',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pcRestored.body?.data?.state === 'AVAILABLE', 'Workstation PC-01 restored to AVAILABLE');

    // Linked maintenance order completed
    const maintUpdated = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/maintenance',
      method: 'GET',
      headers: { Authorization: `Bearer ${astToken}` }
    });
    const finishedMaint = (maintUpdated.body?.data || []).find((m) => m.issueId === issueId);
    assert(finishedMaint?.status === 'COMPLETED', 'Linked MaintenanceRecord marked COMPLETED');

    // ------------------------------------------------------------------------
    // SECTION 7: Multi-Parameter Filtering
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 7: Multi-Parameter Query Filtering ---');
    const resolvedList = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/issues?status=RESOLVED',
      method: 'GET',
      headers: { Authorization: `Bearer ${astToken}` }
    });
    assert(resolvedList.status === 200, 'GET /api/issues?status=RESOLVED returns HTTP 200');
    const allAreResolved = (resolvedList.body?.data || []).every((i) => i.status === 'RESOLVED');
    assert(allAreResolved, 'Filter by status=RESOLVED returns only resolved items');

    const highSevList = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/issues?severity=HIGH',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(highSevList.status === 200, 'GET /api/issues?severity=HIGH returns HTTP 200');
    const allAreHigh = (highSevList.body?.data || []).every((i) => i.severity === 'HIGH');
    assert(allAreHigh, 'Filter by severity=HIGH returns only high severity items');

    // ------------------------------------------------------------------------
    // SECTION 8: Anti-Escalation RBAC Protections
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 8: Anti-Escalation RBAC Protections ---');
    // Student cannot update issue status
    const stuUpdateStatus = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/issues/${issueId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, { status: 'REJECTED' });
    assert(stuUpdateStatus.status === 403, 'Student cannot update issue status (HTTP 403 Forbidden)');

    // Student 2 cannot view Student 1's issue details
    const crossStudentView = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/issues/${issueId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${stu2Token}` }
    });
    assert(crossStudentView.status === 403, 'Student 2 blocked from inspecting Student 1 issue (HTTP 403 Forbidden)');

    // Invalid status rejected
    const badStatus = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/issues/${issueId}/status`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, { status: 'NON_EXISTENT_STATUS' });
    assert(badStatus.status === 400, 'Invalid status rejected with HTTP 400');
    assert(badStatus.body?.error === 'INVALID_STATUS', 'Error code is INVALID_STATUS');

    console.log('\n============================================================');
    console.log(`PHASE 15 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    server.close();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
