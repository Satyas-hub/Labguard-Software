// ============================================================================
// LABGUARD V2: Phase 11 Automated Integration & Verification Test Suite
// Tests Lab Assistant Operational Command Center, Scoped RBAC, Hardware Events,
// Fleet Controls, Attendance Sessions, Maintenance Orders, and Anti-Escalation
// ============================================================================

const http = require('http');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : null;
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

async function runSuite() {
  console.log('\n============================================================');
  console.log('LABGUARD V2 — PHASE 11: LAB ASSISTANT MODULE TEST SUITE');
  console.log('============================================================\n');

  // Start backend in-process by loading compiled server
  const { server } = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/dist/backend/src/server.js');
  await new Promise((resolve) => {
    server.listen(5000, resolve);
  });
  console.log('Backend test server listening on port 5000.');

  let assistantToken = '';
  let adminToken = '';
  let facultyToken = '';
  let studentToken = '';
  let assistantUser = null;

  // --------------------------------------------------------------------------
  // SECTION 1: Authentication & Token Issuance
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 1: Authentication & Scoped Identity ---');

  // 1. Assistant Login
  const astLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'assistant@labguard.edu',
    password: 'Assistant@123456',
    role: 'LAB_ASSISTANT'
  });

  assert(astLogin.status === 200, 'Lab Assistant logs in successfully with HTTP 200');
  assert(astLogin.body?.data?.accessToken, 'Lab Assistant receives valid JWT access token');
  assistantToken = astLogin.body?.data?.accessToken;
  assistantUser = astLogin.body?.data?.user;
  const authorizedLabs = astLogin.body?.data?.authorizedLabs;
  assert(assistantUser?.role === 'LAB_ASSISTANT', 'User role is verified as LAB_ASSISTANT');
  assert(
    Array.isArray(authorizedLabs) && authorizedLabs.length > 0,
    'Assistant identity has assignedLabs populated (LAB-01, LAB-02)'
  );

  // 2. Admin Login
  const admLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'admin@labguard.edu',
    password: 'Admin@123456',
    role: 'ADMIN'
  });
  assert(admLogin.status === 200, 'Administrator logs in successfully');
  adminToken = admLogin.body?.data?.accessToken;

  // 3. Faculty Login
  const facLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'faculty@labguard.edu',
    password: 'Faculty@123456',
    role: 'FACULTY'
  });
  assert(facLogin.status === 200, 'Faculty logs in successfully');
  facultyToken = facLogin.body?.data?.accessToken;

  // 4. Student Login
  const stuLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'student@labguard.edu',
    password: 'Student@123456',
    role: 'STUDENT'
  });
  assert(stuLogin.status === 200, 'Student logs in successfully');
  studentToken = stuLogin.body?.data?.accessToken;

  // --------------------------------------------------------------------------
  // SECTION 2: Assistant Dashboard & Scoped KPI Aggregation
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Operational Dashboard & Fleet Telemetry ---');

  const dashRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/assistant/dashboard',
    method: 'GET',
    headers: { Authorization: `Bearer ${assistantToken}` }
  });

  assert(dashRes.status === 200, 'GET /api/assistant/dashboard returns HTTP 200 for Lab Assistant');
  assert(dashRes.body?.success === true, 'Dashboard response has success: true');
  const d = dashRes.body?.data;
  assert(typeof d?.assignedLabsCount === 'number' && d.assignedLabsCount >= 2, 'Assigned labs count is aggregated (>= 2)');
  assert(typeof d?.totalWorkstations === 'number' && d.totalWorkstations > 0, 'Total workstations count is calculated');
  assert(typeof d?.availableWorkstations === 'number', 'Available workstations count is calculated');
  assert(typeof d?.occupiedWorkstations === 'number', 'Occupied workstations count is calculated');
  assert(typeof d?.maintenanceWorkstations === 'number', 'Maintenance workstations count is calculated');
  assert(typeof d?.openIssuesCount === 'number', 'Open issues count is calculated');
  assert(Array.isArray(d?.assignedLabs) && d.assignedLabs.length >= 2, 'Assigned labs detailed array returned with metrics');

  // Role Protection on Dashboard
  const stuDash = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/assistant/dashboard',
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(stuDash.status === 403, 'Student cannot access assistant dashboard (HTTP 403 Forbidden)');

  const facDash = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/assistant/dashboard',
    method: 'GET',
    headers: { Authorization: `Bearer ${facultyToken}` }
  });
  assert(facDash.status === 403, 'Faculty cannot access assistant dashboard (HTTP 403 Forbidden)');

  const admDash = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/assistant/dashboard',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(admDash.status === 200, 'Administrator can access assistant dashboard (HTTP 200)');

  // --------------------------------------------------------------------------
  // SECTION 3: Scoped Workstation Fleet Management
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Workstation Fleet Scoping & State Controls ---');

  const compRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/computers',
    method: 'GET',
    headers: { Authorization: `Bearer ${assistantToken}` }
  });
  assert(compRes.status === 200, 'GET /api/computers returns HTTP 200 for Lab Assistant');
  const pcs = compRes.body?.data || [];
  assert(pcs.length > 0, 'Computers returned for assistant');
  const unassignedPcs = pcs.filter((pc) => pc.labCode === 'LAB-03');
  assert(unassignedPcs.length === 0, 'Assistant cannot see workstations in unassigned facilities (LAB-03)');

  // Workstation state transition: AVAILABLE -> MAINTENANCE -> AVAILABLE
  const targetPc = pcs.find((pc) => pc.state === 'AVAILABLE') || pcs[0];
  const stateChange1 = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/computers/${targetPc.id}/state`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, { state: 'MAINTENANCE' });
  assert(stateChange1.status === 200, 'Assistant can transition assigned workstation to MAINTENANCE');

  const stateChange2 = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/computers/${targetPc.id}/state`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, { state: 'AVAILABLE' });
  assert(stateChange2.status === 200, 'Assistant can transition assigned workstation back to AVAILABLE');

  // Anti-escalation: Assistant cannot delete or provision computers
  const deleteCompAttempt = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/computers/${targetPc.id}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${assistantToken}` }
  });
  assert(deleteCompAttempt.status === 403, 'Assistant cannot DELETE computers (HTTP 403 Forbidden)');

  const createCompAttempt = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/computers',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, { labCode: 'LAB-01', pcCode: 'PC-99' });
  assert(createCompAttempt.status === 403, 'Assistant cannot POST /api/computers (HTTP 403 Forbidden)');

  // --------------------------------------------------------------------------
  // SECTION 4: Live Attendance Sessions & Safe Termination
  // --------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Attendance Roster (Who's In / Who's Out) ---");

  // Student starts session on LAB-01 PC-01
  const startSess = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sessions/start',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` }
  }, { labCode: 'LAB-01', pcCode: 'PC-01' });
  assert(startSess.status === 201 || startSess.status === 409, 'Student session started or active');
  const activeSessId = startSess.body?.data?.id;

  // Assistant inspects sessions
  const sessList = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/sessions',
    method: 'GET',
    headers: { Authorization: `Bearer ${assistantToken}` }
  });
  assert(sessList.status === 200, 'Assistant can list active and recent sessions in assigned labs');
  const foundSess = (sessList.body?.data || []).find((s) => s.pcCode === 'PC-01' && s.status === 'ACTIVE');
  assert(foundSess !== undefined, 'Assistant sees live active student session in assigned lab');

  // Assistant safely ends student session
  if (foundSess) {
    const endSess = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/sessions/end',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
    }, { sessionId: foundSess.id, endMode: 'FORCED_END' });
    assert(endSess.status === 200, 'Assistant can authoritatively end student session (HTTP 200)');
    assert(endSess.body?.data?.status === 'COMPLETED', 'Session marked as COMPLETED');
    assert(endSess.body?.data?.endMode === 'FORCED_END', 'Session endMode recorded as FORCED_END');
  }

  // --------------------------------------------------------------------------
  // SECTION 5: Hardware Peripheral Events Telemetry
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Hardware Peripheral Events & Telemetry ---');

  const hweList = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/hardware-events',
    method: 'GET',
    headers: { Authorization: `Bearer ${assistantToken}` }
  });
  assert(hweList.status === 200, 'GET /api/hardware-events returns HTTP 200');
  assert(Array.isArray(hweList.body?.data), 'Hardware events list returned as array');

  // Assistant logs new hardware incident in assigned lab (LAB-01)
  const createHwe = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/hardware-events',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, {
    labCode: 'LAB-01',
    pcCode: 'PC-02',
    eventType: 'HARDWARE_DISCONNECTED',
    description: 'USB Mouse physically disconnected during inspection'
  });
  assert(createHwe.status === 201, 'Assistant logs new hardware event with HTTP 201');
  const loggedEventId = createHwe.body?.data?.id;
  assert(createHwe.body?.data?.acknowledged === false, 'New hardware event defaults to unacknowledged');

  // Assistant acknowledges the event
  const ackHwe = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/hardware-events/${loggedEventId}/acknowledge`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${assistantToken}` }
  });
  assert(ackHwe.status === 200, 'Assistant can acknowledge hardware event');
  assert(ackHwe.body?.data?.acknowledged === true, 'Event state updated to acknowledged: true');

  // Assistant attempts to log hardware event in unassigned lab (LAB-03)
  const unassignedHwe = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/hardware-events',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, {
    labCode: 'LAB-03',
    pcCode: 'PC-01',
    eventType: 'HARDWARE_DISCONNECTED',
    description: 'Unauthorized access test'
  });
  assert(unassignedHwe.status === 403, 'Assistant cannot log hardware events for unassigned lab (HTTP 403 Forbidden)');

  // Student cannot log hardware events
  const stuHweAttempt = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/hardware-events',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` }
  }, {
    labCode: 'LAB-01',
    pcCode: 'PC-01',
    eventType: 'HARDWARE_DISCONNECTED',
    description: 'Student test'
  });
  assert(stuHweAttempt.status === 403, 'Student cannot log hardware events (HTTP 403 Forbidden)');

  // --------------------------------------------------------------------------
  // SECTION 6: Physical Equipment Accountability & Swapping
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Physical Equipment & Peripheral Swapping ---');

  const equipRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/equipment',
    method: 'GET',
    headers: { Authorization: `Bearer ${assistantToken}` }
  });
  assert(equipRes.status === 200, 'Assistant can query equipment list in assigned labs');
  const allEquip = equipRes.body?.data || [];
  assert(allEquip.length > 0, 'Equipment inventory is populated');

  // Find a functional spare and an assigned item
  const assignedItem = allEquip.find((e) => e.computerId && (e.labCode === 'LAB-01' || e.labCode === 'LAB-02'));
  const spareItem = allEquip.find((e) => !e.computerId && e.type === assignedItem?.type && (e.status === 'AVAILABLE' || e.status === 'FUNCTIONAL'));

  if (assignedItem && spareItem) {
    const replaceRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/equipment/${assignedItem.id}/replace`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
    }, {
      spareEquipmentId: spareItem.id,
      defectNotes: 'Scroll wheel erratic in testing. Replaced with spare.'
    });
    assert(replaceRes.status === 200, 'Assistant can atomically replace defective peripheral with spare');
    assert(replaceRes.body?.data?.replacedItem?.status === 'FAULTY', 'Replaced defective item marked FAULTY');
    assert(replaceRes.body?.data?.spareItem?.status === 'FUNCTIONAL', 'Spare item marked FUNCTIONAL on target workstation');
  }

  // Anti-escalation: Assistant cannot delete equipment
  const deleteEquipAttempt = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/equipment/${allEquip[0]?.id || 'dummy'}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${assistantToken}` }
  });
  assert(deleteEquipAttempt.status === 403, 'Assistant cannot DELETE equipment assets (HTTP 403 Forbidden)');

  // --------------------------------------------------------------------------
  // SECTION 7: Issue Triage & Maintenance Work Orders
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Issue Triage & Maintenance Work Orders ---');

  // Student reports an issue
  const reportIssueRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/issues',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` }
  }, {
    labCode: 'LAB-01',
    pcCode: 'PC-02',
    issueType: 'Keyboard Problem',
    description: 'Spacebar sticking repeatedly'
  });
  assert(reportIssueRes.status === 201, 'Student reports issue on LAB-01/PC-02');
  const reportedIssueId = reportIssueRes.body?.data?.id;

  // Assistant lists issues
  const astIssues = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/issues',
    method: 'GET',
    headers: { Authorization: `Bearer ${assistantToken}` }
  });
  assert(astIssues.status === 200, 'Assistant lists issues in assigned labs');
  const foundIssue = (astIssues.body?.data || []).find((i) => i.id === reportedIssueId);
  assert(foundIssue !== undefined, 'Reported issue found in assistant queue');

  // Assistant moves issue to MAINTENANCE
  const triageRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/issues/${reportedIssueId}/status`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, {
    status: 'MAINTENANCE',
    resolutionNotes: 'Key switch mechanism broken, replacement scheduled.'
  });
  assert(triageRes.status === 200, 'Assistant updates issue to MAINTENANCE status');

  // Assistant creates a direct maintenance work order
  const createMaint = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/maintenance',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, {
    labId: 'lab00001-0000-0000-0000-000000000001',
    computerId: 'pc000002-0000-0000-0000-000000000002',
    actionTaken: 'Clean internal chassis fans and reseat RAM modules',
    responsibleUser: 'David Vance (Lab Assistant)',
    cost: 0,
    notes: 'Routine thermal maintenance'
  });
  assert(createMaint.status === 201, 'Assistant creates maintenance work order (HTTP 201)');
  const maintRecordId = createMaint.body?.data?.id;

  // Assistant completes the maintenance order
  const completeMaint = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/maintenance/${maintRecordId}`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, {
    status: 'COMPLETED',
    notes: 'Bench testing complete. All RAM channels functional.'
  });
  assert(completeMaint.status === 200, 'Assistant completes maintenance work order');
  assert(completeMaint.body?.data?.status === 'COMPLETED', 'Work order status marked COMPLETED');

  // Student cannot create maintenance orders
  const stuMaintAttempt = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/maintenance',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` }
  }, {
    labId: 'lab00001-0000-0000-0000-000000000001',
    computerId: 'PC-01',
    actionTaken: 'Hack'
  });
  assert(stuMaintAttempt.status === 403, 'Student cannot create maintenance orders (HTTP 403 Forbidden)');

  // --------------------------------------------------------------------------
  // SECTION 8: Anti-Escalation & Strict Administrative Boundary Guards
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 8: Strict Anti-Escalation RBAC Boundary Tests ---');

  // Assistant cannot create departments
  const deptEsc = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/departments',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, { code: 'ILLEGAL', name: 'Illegal Dept' });
  assert(deptEsc.status === 403, 'Assistant cannot create academic departments (HTTP 403 Forbidden)');

  // Assistant cannot create courses
  const courseEsc = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/courses',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, { code: 'ILLEGAL', name: 'Illegal Course' });
  assert(courseEsc.status === 403, 'Assistant cannot create academic courses (HTTP 403 Forbidden)');

  // Assistant cannot create or manage users
  const userEsc = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/users',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, { email: 'fake@labguard.edu', fullName: 'Fake User' });
  assert(userEsc.status === 403, 'Assistant cannot create users (HTTP 403 Forbidden)');

  // Assistant cannot delete laboratories
  const labEsc = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/labs/lab00001-0000-0000-0000-000000000001',
    method: 'DELETE',
    headers: { Authorization: `Bearer ${assistantToken}` }
  });
  assert(labEsc.status === 403, 'Assistant cannot delete laboratories (HTTP 403 Forbidden)');

  // Assistant cannot review enrollment requests
  const enrollEsc = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/enrollment-requests/dummy/review',
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` }
  }, { decision: 'APPROVE' });
  assert(enrollEsc.status === 403, 'Assistant cannot review enrollment requests (HTTP 403 Forbidden)');

  // Assistant cannot view admin audit logs
  const auditEsc = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/audit-logs',
    method: 'GET',
    headers: { Authorization: `Bearer ${assistantToken}` }
  });
  assert(auditEsc.status === 403, 'Assistant cannot access system audit logs (HTTP 403 Forbidden)');

  console.log('\n============================================================');
  console.log(`PHASE 11 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('============================================================\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

runSuite().catch((err) => {
  console.error('Test Suite encountered fatal error:', err);
  process.exit(1);
});
