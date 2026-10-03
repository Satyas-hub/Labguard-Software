// ============================================================================
// LABGUARD V2 — PHASE 22: REPORTING SYSTEM TEST SUITE
// Tests institutional report generators, role-based scoping, and multi-format
// exports for CSV, Excel XML, and Printable PDF layouts.
// ============================================================================

const http = require('http');

const PORT = 5002;
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
    const req = http.request({ port: PORT, ...options }, (res) => {
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
  console.log('LABGUARD V2 — PHASE 22: REPORTING SYSTEM TEST SUITE');
  console.log('============================================================\n');

  // Start backend server
  const { server } = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/dist/backend/src/server.js');
  await new Promise((resolve) => {
    server.listen(PORT, resolve);
  });
  console.log(`Backend reporting test server listening on port ${PORT}.\n`);

  let adminToken = '';
  let facultyToken = '';
  let assistantToken = '';
  let studentToken = '';

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Role Authentication
    // ------------------------------------------------------------------------
    console.log('--- SECTION 1: Authentication Across All User Roles ---');
    const adminLogin = await request(
      { method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' } },
      { identifier: 'admin@labguard.edu', password: 'Admin@123456', role: 'ADMIN' }
    );
    assert(adminLogin.status === 200 && adminLogin.body.data.accessToken, 'Admin logged in successfully');
    adminToken = adminLogin.body.data.accessToken;

    const facLogin = await request(
      { method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' } },
      { identifier: 'faculty@labguard.edu', password: 'Faculty@123456', role: 'FACULTY' }
    );
    assert(facLogin.status === 200 && facLogin.body.data.accessToken, 'Faculty logged in successfully');
    facultyToken = facLogin.body.data.accessToken;

    const asstLogin = await request(
      { method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' } },
      { identifier: 'assistant@labguard.edu', password: 'Assistant@123456', role: 'LAB_ASSISTANT' }
    );
    assert(asstLogin.status === 200 && asstLogin.body.data.accessToken, 'Assistant logged in successfully');
    assistantToken = asstLogin.body.data.accessToken;

    const stuLogin = await request(
      { method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' } },
      { identifier: 'student@labguard.edu', password: 'Student@123456', role: 'STUDENT' }
    );
    assert(stuLogin.status === 200 && stuLogin.body.data.accessToken, 'Student logged in successfully');
    studentToken = stuLogin.body.data.accessToken;

    // ------------------------------------------------------------------------
    // SECTION 2: Role-Based Report Type Discovery
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Role-Based Report Type Discovery ---');
    
    // Admin report types
    const adminTypesRes = await request({
      method: 'GET',
      path: '/api/reports/types',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminTypesRes.status === 200, 'Admin /api/reports/types returns HTTP 200');
    assert(adminTypesRes.body.data.length === 5, 'Admin has access to all 5 reporting modules');
    const adminTypeIds = adminTypesRes.body.data.map((t) => t.id);
    assert(adminTypeIds.includes('SESSION_HISTORY') && adminTypeIds.includes('AUDIT_ACTIVITY'), 'Admin includes SESSION_HISTORY and AUDIT_ACTIVITY');

    // Faculty report types
    const facTypesRes = await request({
      method: 'GET',
      path: '/api/reports/types',
      headers: { Authorization: `Bearer ${facultyToken}` }
    });
    assert(facTypesRes.status === 200 && facTypesRes.body.data.length === 3, 'Faculty has access to 3 academic report types');
    assert(!facTypesRes.body.data.map((t) => t.id).includes('AUDIT_ACTIVITY'), 'Faculty excluded from AUDIT_ACTIVITY');

    // Assistant report types
    const asstTypesRes = await request({
      method: 'GET',
      path: '/api/reports/types',
      headers: { Authorization: `Bearer ${assistantToken}` }
    });
    assert(asstTypesRes.status === 200 && asstTypesRes.body.data.length === 3, 'Assistant has access to 3 operational report types');
    assert(asstTypesRes.body.data.map((t) => t.id).includes('EQUIPMENT_MAINTENANCE'), 'Assistant includes EQUIPMENT_MAINTENANCE');

    // Student report types
    const stuTypesRes = await request({
      method: 'GET',
      path: '/api/reports/types',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(stuTypesRes.status === 200 && stuTypesRes.body.data.length === 1, 'Student strictly restricted to 1 report type');
    assert(stuTypesRes.body.data[0].id === 'SESSION_HISTORY', 'Student report type is personal SESSION_HISTORY');

    // ------------------------------------------------------------------------
    // SECTION 3: Report Data Generation (JSON Payloads)
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Report Data Generation & KPI Aggregation ---');

    // 1. Session History
    const sessRep = await request(
      { method: 'POST', path: '/api/reports/generate', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } },
      { reportType: 'SESSION_HISTORY' }
    );
    assert(sessRep.status === 200 && sessRep.body.success, 'Session History report generated');
    assert(Array.isArray(sessRep.body.data.columns) && sessRep.body.data.columns.includes('Student Name'), 'Session report has correct column headers');
    assert(typeof sessRep.body.data.summary.totalSessions === 'number', 'Session report contains totalSessions KPI');

    // 2. PC Usage
    const pcRep = await request(
      { method: 'POST', path: '/api/reports/generate', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } },
      { reportType: 'PC_USAGE' }
    );
    assert(pcRep.status === 200 && pcRep.body.success, 'PC Usage report generated');
    assert(pcRep.body.data.columns.includes('Workstation Code') && pcRep.body.data.columns.includes('Total Sessions'), 'PC Usage contains Workstation Code & Total Sessions');
    assert(typeof pcRep.body.data.summary.totalWorkstations === 'number', 'PC Usage contains totalWorkstations KPI');

    // 3. Lab Utilization
    const labRep = await request(
      { method: 'POST', path: '/api/reports/generate', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } },
      { reportType: 'LAB_UTILIZATION' }
    );
    assert(labRep.status === 200 && labRep.body.success, 'Lab Utilization report generated');
    assert(labRep.body.data.columns.includes('Occupancy Rate (%)'), 'Lab report calculates Occupancy Rate (%)');
    assert(typeof labRep.body.data.summary.totalCapacity === 'number', 'Lab report aggregates totalCapacity');

    // 4. Equipment Maintenance
    const maintRep = await request(
      { method: 'POST', path: '/api/reports/generate', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } },
      { reportType: 'EQUIPMENT_MAINTENANCE' }
    );
    assert(maintRep.status === 200 && maintRep.body.success, 'Equipment Maintenance report generated');
    assert(maintRep.body.data.columns.includes('Order ID') && maintRep.body.data.columns.includes('Cost ($)'), 'Maintenance report includes Order ID and Cost');

    // 5. Audit Activity
    const auditRep = await request(
      { method: 'POST', path: '/api/reports/generate', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } },
      { reportType: 'AUDIT_ACTIVITY' }
    );
    assert(auditRep.status === 200 && auditRep.body.success, 'Audit Activity report generated');
    assert(auditRep.body.data.columns.includes('Action Performed') && auditRep.body.data.columns.includes('Actor'), 'Audit report includes Action Performed and Actor');

    // ------------------------------------------------------------------------
    // SECTION 4: Multi-Format Exporters (CSV, Excel XML, Printable PDF)
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Multi-Format Exporters ---');

    // CSV Export
    const csvRes = await request({
      method: 'GET',
      path: '/api/reports/export/SESSION_HISTORY?format=CSV',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(csvRes.status === 200, 'CSV export returns HTTP 200');
    assert(csvRes.headers['content-type'].includes('text/csv'), 'CSV export specifies text/csv MIME');
    assert(csvRes.headers['content-disposition'].includes('.csv'), 'Content-Disposition includes .csv filename');
    assert(csvRes.raw.includes('# LABGUARD V2 INSTITUTIONAL REPORT'), 'CSV contains institutional banner metadata');
    assert(csvRes.raw.includes('"Session ID"') && csvRes.raw.includes('"Student Name"'), 'CSV contains header columns');

    // Excel Export (.xls)
    const excelRes = await request({
      method: 'GET',
      path: '/api/reports/export/PC_USAGE?format=EXCEL',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(excelRes.status === 200, 'Excel export returns HTTP 200');
    assert(excelRes.headers['content-type'].includes('application/vnd.ms-excel'), 'Excel export specifies application/vnd.ms-excel MIME');
    assert(excelRes.headers['content-disposition'].includes('.xls'), 'Content-Disposition includes .xls filename');
    assert(excelRes.raw.includes('<?xml version="1.0" encoding="UTF-8"?>'), 'Excel export output is valid XML');
    assert(excelRes.raw.includes('<Workbook') && excelRes.raw.includes('<Worksheet'), 'Excel export contains Workbook and Worksheet structures');

    // PDF / Printable HTML Export
    const pdfRes = await request({
      method: 'GET',
      path: '/api/reports/export/LAB_UTILIZATION?format=PDF',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pdfRes.status === 200, 'Printable layout returns HTTP 200');
    assert(pdfRes.headers['content-type'].includes('text/html'), 'Printable layout specifies text/html MIME');
    assert(pdfRes.raw.includes('@media print'), 'Printable layout includes @media print CSS rules');
    assert(pdfRes.raw.includes('Facility Fleet Utilization & Capacity Report'), 'Printable layout includes styled report title');
    assert(pdfRes.raw.includes('Report Summary KPI Aggregates:'), 'Printable layout renders KPI summary box');

    // ------------------------------------------------------------------------
    // SECTION 5: Security & Anti-Escalation RBAC Enforcement
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Security & Anti-Escalation Scoping ---');

    // Student attempting to generate Audit report -> 403
    const stuForbiddenAudit = await request(
      { method: 'POST', path: '/api/reports/generate', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` } },
      { reportType: 'AUDIT_ACTIVITY' }
    );
    assert(stuForbiddenAudit.status === 403, 'Student blocked from generating AUDIT_ACTIVITY report with HTTP 403');

    // Student attempting to export Maintenance report -> 403
    const stuForbiddenMaint = await request({
      method: 'GET',
      path: '/api/reports/export/EQUIPMENT_MAINTENANCE?format=CSV',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(stuForbiddenMaint.status === 403, 'Student blocked from exporting EQUIPMENT_MAINTENANCE with HTTP 403');

    // Faculty attempting to generate Audit report -> 403
    const facForbiddenAudit = await request(
      { method: 'POST', path: '/api/reports/generate', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${facultyToken}` } },
      { reportType: 'AUDIT_ACTIVITY' }
    );
    assert(facForbiddenAudit.status === 403, 'Faculty blocked from AUDIT_ACTIVITY with HTTP 403');

    // Assistant attempting to generate Audit report -> 403
    const asstForbiddenAudit = await request(
      { method: 'POST', path: '/api/reports/generate', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${assistantToken}` } },
      { reportType: 'AUDIT_ACTIVITY' }
    );
    assert(asstForbiddenAudit.status === 403, 'Assistant blocked from AUDIT_ACTIVITY with HTTP 403');

    // Student Session Report strictly scopes to self
    const stuSelfSession = await request(
      { method: 'POST', path: '/api/reports/generate', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` } },
      { reportType: 'SESSION_HISTORY' }
    );
    assert(stuSelfSession.status === 200, 'Student allowed to generate own SESSION_HISTORY');
    const allStudentNames = stuSelfSession.body.data.rows.map((r) => r[1]);
    const foreignStudents = allStudentNames.filter((name) => name !== 'Student' && name !== stuLogin.body.data.user.fullName);
    assert(foreignStudents.length === 0, 'Student report output strictly isolates foreign student sessions');

    // Facility filter verification
    const labFilteredRes = await request(
      { method: 'POST', path: '/api/reports/generate', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } },
      { reportType: 'PC_USAGE', labCode: 'LAB-01' }
    );
    assert(labFilteredRes.status === 200, 'Lab filtered report returns HTTP 200');
    const nonLab1Pcs = labFilteredRes.body.data.rows.filter((r) => r[1] !== 'LAB-01');
    assert(nonLab1Pcs.length === 0, 'Facility filter accurately isolates LAB-01 workstations');
  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
