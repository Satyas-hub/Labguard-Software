// ============================================================================
// LABGUARD V2 — PHASE 18: AUDIT TRAIL SYSTEM TEST SUITE
// ============================================================================

const http = require('http');

const PORT = 5000;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
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
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
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
  console.log('============================================================');
  console.log('LABGUARD V2 — PHASE 18: AUDIT TRAIL TEST SUITE');
  console.log('============================================================\n');

  // Start backend in-process by loading compiled server
  const { server } = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/dist/backend/src/server.js');
  await new Promise((resolve) => {
    server.listen(PORT, resolve);
  });
  console.log(`Backend test server listening on port ${PORT}.\n`);

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Authentication Setup & Activity Triggering
    // ------------------------------------------------------------------------
    console.log('--- SECTION 1: Authentication & Event Triggering ---');
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

    // Trigger an administrative action: create a user
    const createUsr = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/admin/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      email: 'audit_test_user@labguard.edu',
      password: 'User@123456',
      fullName: 'Audit Test Subject',
      role: 'STUDENT',
      identifier: 'STU-AUDIT-001',
      department: 'Computer Science'
    });
    assert(createUsr.status === 201 || createUsr.status === 200, 'Admin triggers user creation action');

    // Trigger maintenance creation action
    const createMaint = await request({
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
      computerId: 'PC-01',
      actionTaken: 'Routine thermal and fan dusting',
      cost: 15.00,
      status: 'SCHEDULED'
    });
    assert(createMaint.status === 201, 'Assistant triggers maintenance action');

    // ------------------------------------------------------------------------
    // SECTION 2: General Audit Trail Retrieval
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Audit Trail Retrieval ---');
    const logsRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(logsRes.status === 200, 'GET /api/audit-logs returns HTTP 200');
    assert(Array.isArray(logsRes.body?.data), 'Audit logs data is returned as an array');
    assert(logsRes.body?.data?.length > 0, 'Audit trail contains recorded events');
    const sampleLog = logsRes.body?.data?.[0];
    assert(!!sampleLog?.id, 'Audit entry has unique ID');
    assert(!!sampleLog?.actorName, 'Audit entry records actor name');
    assert(!!sampleLog?.action, 'Audit entry records action code');
    assert(!!sampleLog?.timestamp, 'Audit entry has timestamp');

    // ------------------------------------------------------------------------
    // SECTION 3: Multi-Parameter Filtering & Search
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Multi-Parameter Filtering & Search ---');
    // Filter by role=ADMIN
    const adminFilter = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs?role=ADMIN',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminFilter.status === 200, 'Filter by role=ADMIN returns HTTP 200');
    assert(adminFilter.body?.data?.every((l) => l.role === 'ADMIN'), 'All returned entries have role ADMIN');

    // Filter by role=LAB_ASSISTANT
    const astFilter = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs?role=LAB_ASSISTANT',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(astFilter.status === 200, 'Filter by role=LAB_ASSISTANT returns HTTP 200');
    assert(astFilter.body?.data?.every((l) => l.role === 'LAB_ASSISTANT'), 'All returned entries have role LAB_ASSISTANT');

    // Filter by action substring
    const actionFilter = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs?action=MAINTENANCE',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(actionFilter.status === 200, 'Filter by action=MAINTENANCE returns HTTP 200');
    assert(actionFilter.body?.data?.some((l) => l.action.includes('MAINTENANCE')), 'Found MAINTENANCE audit records');

    // Full text search
    const searchFilter = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs?search=thermal',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(searchFilter.status === 200, 'Search by keyword returns HTTP 200');

    // ------------------------------------------------------------------------
    // SECTION 4: Pagination & Deterministic Sorting
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Pagination & Ordering ---');
    // Limit to 2 entries
    const page1 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs?limit=2&offset=0',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(page1.status === 200, 'Pagination page 1 returns HTTP 200');
    assert(page1.body?.data?.length <= 2, 'Page 1 respects limit=2');
    const page1FirstId = page1.body?.data?.[0]?.id;

    // Page 2
    const page2 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs?limit=2&offset=2',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(page2.status === 200, 'Pagination page 2 returns HTTP 200');
    if (page1.body?.total > 2) {
      assert(page2.body?.data?.[0]?.id !== page1FirstId, 'Page 2 contains different records than Page 1');
    }

    // Ascending vs Descending order
    const ascOrder = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs?order=asc&limit=5',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(ascOrder.status === 200, 'order=asc query returns HTTP 200');
    const ascLogs = ascOrder.body?.data || [];
    if (ascLogs.length >= 2) {
      const t0 = new Date(ascLogs[0].timestamp).getTime();
      const t1 = new Date(ascLogs[1].timestamp).getTime();
      assert(t0 <= t1, 'Chronological ordering verified (oldest first)');
    }

    // ------------------------------------------------------------------------
    // SECTION 5: Single Audit Record Inspection & Metadata
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Detailed Record Inspection & Metadata ---');
    const detailRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/audit-logs/${sampleLog.id}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(detailRes.status === 200, 'GET /api/audit-logs/:id returns HTTP 200');
    assert(detailRes.body?.data?.id === sampleLog.id, 'Retrieved record matches requested ID');

    // Metadata summary endpoint
    const metaRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs/metadata',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(metaRes.status === 200, 'GET /api/audit-logs/metadata returns HTTP 200');
    assert(typeof metaRes.body?.data?.totalRecords === 'number', 'Total audit records count returned');
    assert(Array.isArray(metaRes.body?.data?.distinctActions), 'Distinct actions array returned');
    assert(Array.isArray(metaRes.body?.data?.distinctRoles), 'Distinct roles array returned');

    // ------------------------------------------------------------------------
    // SECTION 6: Audit Export Engine (CSV & JSON)
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Audit Trail Export Engine ---');
    // Export JSON
    const jsonExport = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs/export?format=json',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(jsonExport.status === 200, 'Export JSON returns HTTP 200');
    assert(Array.isArray(jsonExport.body), 'JSON export body is a valid JSON array');

    // Export CSV
    const csvExport = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs/export?format=csv',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(csvExport.status === 200, 'Export CSV returns HTTP 200');
    assert(csvExport.headers['content-type']?.includes('text/csv'), 'Content-Type header is text/csv');
    assert(csvExport.raw.startsWith('ID,Timestamp,Actor Name,Role,Action,Entity Type,Entity ID,Lab ID'), 'CSV headers correctly formatted');

    // ------------------------------------------------------------------------
    // SECTION 7: Anti-Tampering Immutability Guards
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 7: Anti-Tampering Immutability Guards ---');
    // Attempt DELETE
    const delAttempt = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/audit-logs/${sampleLog.id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(delAttempt.status === 403, 'DELETE /api/audit-logs/:id rejected with HTTP 403 Forbidden');
    assert(delAttempt.body?.error === 'IMMUTABLE_AUDIT_LOG', 'Rejection code is IMMUTABLE_AUDIT_LOG');

    // Attempt PUT
    const putAttempt = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/audit-logs/${sampleLog.id}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, { action: 'TAMPERED_ACTION' });
    assert(putAttempt.status === 403, 'PUT /api/audit-logs/:id rejected with HTTP 403 Forbidden');

    // Attempt PATCH
    const patchAttempt = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/audit-logs/${sampleLog.id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, { action: 'TAMPERED_ACTION' });
    assert(patchAttempt.status === 403, 'PATCH /api/audit-logs/:id rejected with HTTP 403 Forbidden');

    // ------------------------------------------------------------------------
    // SECTION 8: Strict Anti-Escalation RBAC Protections
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 8: Anti-Escalation RBAC Protections ---');
    // Student blocked
    const stuAudit = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(stuAudit.status === 403, 'Student cannot access audit logs (HTTP 403 Forbidden)');

    // Faculty blocked
    const facAudit = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${facToken}` }
    });
    assert(facAudit.status === 403, 'Faculty cannot access audit logs (HTTP 403 Forbidden)');

    // Lab Assistant blocked
    const astAudit = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit-logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${astToken}` }
    });
    assert(astAudit.status === 403, 'Lab Assistant cannot access audit logs (HTTP 403 Forbidden)');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('\nBackend test server stopped.');
  }

  console.log('\n============================================================');
  console.log(`PHASE 18 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
