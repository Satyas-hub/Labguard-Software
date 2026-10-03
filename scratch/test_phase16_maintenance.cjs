// ============================================================================
// LABGUARD V2 — PHASE 16: MAINTENANCE MODULE TEST SUITE
// Tests:
// 1. Maintenance Work Order Provisioning (Technician, Cost, Workstation Coupling)
// 2. Automated Workstation Operational Transition to MAINTENANCE
// 3. Detailed Work Order Inspection (Linked Hardware Node & Diagnostics)
// 4. Maintenance Telemetry & Aggregation (GET /api/maintenance/stats)
// 5. Work Order Lifecycle Progression (SCHEDULED -> IN_PROGRESS -> COMPLETED)
// 6. Automated Workstation Operational Restoration to AVAILABLE
// 7. Work Order Cancellation API & Workstation Release
// 8. Strict Scoped RBAC (Student blocked, Assistant lab-scoped)
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
  console.log('LABGUARD V2 — PHASE 16: MAINTENANCE MODULE TEST SUITE');
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

    // ------------------------------------------------------------------------
    // SECTION 2: Maintenance Work Order Provisioning
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Work Order Creation & State Coupling ---');
    const createOrder = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/maintenance',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      labCode: 'LAB-01',
      computerId: 'pc-02',
      equipmentId: 'eq-kb-02',
      responsibleUser: 'David Vance (Senior Lab Technician)',
      actionTaken: 'Power supply voltage regulator check and thermal paste reapplication',
      cost: 45.50,
      status: 'IN_PROGRESS',
      notes: 'Scheduled preventive servicing'
    });

    assert(createOrder.status === 201, 'Maintenance work order created (HTTP 201)');
    assert(createOrder.body?.data?.status === 'IN_PROGRESS', 'Work order status is IN_PROGRESS');
    const orderId = createOrder.body?.data?.id;
    assert(!!orderId, 'Unique Maintenance Order ID generated');
    assert(createOrder.body?.data?.cost === 45.50, 'Maintenance cost recorded');

    // Verify PC-02 automatically transitioned to MAINTENANCE
    const pc02Check = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers/pc-02',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pc02Check.body?.data?.state === 'MAINTENANCE', 'Workstation PC-02 automatically marked MAINTENANCE');

    // ------------------------------------------------------------------------
    // SECTION 3: Detailed Maintenance Inspection
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Detailed Work Order Inspection ---');
    const detailRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/maintenance/${orderId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${astToken}` }
    });
    assert(detailRes.status === 200, 'GET /api/maintenance/:id returns HTTP 200');
    assert(detailRes.body?.data?.record?.id === orderId, 'Retrieved record matches order ID');
    assert(!!detailRes.body?.data?.workstation, 'Work order linked to workstation node');
    assert(detailRes.body?.data?.workstation?.pcCode === 'PC-02', 'Linked workstation is PC-02');

    // ------------------------------------------------------------------------
    // SECTION 4: Maintenance Aggregated Statistics
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Maintenance Metrics & Telemetry ---');
    const statsRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/maintenance/stats',
      method: 'GET',
      headers: { Authorization: `Bearer ${astToken}` }
    });
    assert(statsRes.status === 200, 'GET /api/maintenance/stats returns HTTP 200');
    assert(typeof statsRes.body?.data?.total === 'number', 'Total records count returned');
    assert(statsRes.body?.data?.inProgress >= 1, 'In-progress count is at least 1');
    assert(typeof statsRes.body?.data?.totalCost === 'number', 'Total maintenance cost returned');

    // ------------------------------------------------------------------------
    // SECTION 5: Work Order Progression & Completion
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Work Order Update & Completion ---');
    const updateRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/maintenance/${orderId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      actionTaken: 'Completed PSU capacitors check and replaced thermal compound',
      cost: 65.00,
      status: 'COMPLETED',
      notes: 'Workstation fully tested and stable under burn-in benchmark'
    });
    assert(updateRes.status === 200, 'Work order completed successfully (HTTP 200)');
    assert(updateRes.body?.data?.status === 'COMPLETED', 'Work order status is COMPLETED');
    assert(!!updateRes.body?.data?.endTime, 'endTime timestamp recorded');
    assert(updateRes.body?.data?.cost === 65.00, 'Updated maintenance cost recorded');

    // Verify PC-02 automatically restored to AVAILABLE
    const pc02Restored = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers/pc-02',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pc02Restored.body?.data?.state === 'AVAILABLE', 'Workstation PC-02 restored to AVAILABLE');

    // ------------------------------------------------------------------------
    // SECTION 6: Work Order Cancellation Workflow
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Work Order Cancellation ---');
    // Create second order on PC-03
    const order2 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/maintenance',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      labCode: 'LAB-01',
      computerId: 'pc-03',
      responsibleUser: 'David Vance',
      actionTaken: 'Investigate monitor flicker',
      status: 'SCHEDULED'
    });
    assert(order2.status === 201, 'Second maintenance order created on PC-03');
    const order2Id = order2.body?.data?.id;

    // Cancel order
    const cancelRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/maintenance/${order2Id}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, { reason: 'False alarm - HDMI cable was loosely connected' });
    assert(cancelRes.status === 200, 'Maintenance order cancelled (HTTP 200)');
    assert(cancelRes.body?.data?.status === 'CANCELLED', 'Order status marked CANCELLED');

    // Workstation PC-03 restored to AVAILABLE
    const pc03Restored = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/computers/pc-03',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pc03Restored.body?.data?.state === 'AVAILABLE', 'Workstation PC-03 restored to AVAILABLE after cancellation');

    // ------------------------------------------------------------------------
    // SECTION 7: Strict Anti-Escalation RBAC Protections
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 7: Anti-Escalation RBAC Protections ---');
    // Student cannot list maintenance
    const stuListMaint = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/maintenance',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(stuListMaint.status === 403, 'Student cannot list maintenance orders (HTTP 403 Forbidden)');

    // Student cannot create maintenance
    const stuCreateMaint = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/maintenance',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, { labCode: 'LAB-01', computerId: 'pc-01', actionTaken: 'Hacking' });
    assert(stuCreateMaint.status === 403, 'Student cannot create maintenance orders (HTTP 403 Forbidden)');

    // Student cannot cancel maintenance
    const stuCancel = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/maintenance/${orderId}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, { reason: 'Unauthorized cancel' });
    assert(stuCancel.status === 403, 'Student cannot cancel maintenance orders (HTTP 403 Forbidden)');

    // Assistant cannot touch maintenance in an unassigned lab (LAB-03)
    const outOfScopeMaint = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/maintenance',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      labCode: 'LAB-03',
      computerId: 'pc-017',
      responsibleUser: 'David Vance',
      actionTaken: 'Unauthorized repair outside assigned building'
    });
    assert(outOfScopeMaint.status === 403, 'Assistant cannot create maintenance for unassigned lab (HTTP 403 Forbidden)');

    console.log('\n============================================================');
    console.log(`PHASE 16 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    server.close();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
