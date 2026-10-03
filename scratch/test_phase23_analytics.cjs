// ============================================================================
// LABGUARD V2 — PHASE 23: ANALYTICS DASHBOARD TEST SUITE
// Tests multi-dimensional aggregated analytics, zero mock charts verification,
// explicit empty states, timeframe cutoffs, and facility scoping.
// ============================================================================

const http = require('http');

const PORT = 5003;
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
  console.log('LABGUARD V2 — PHASE 23: ANALYTICS DASHBOARD TEST SUITE');
  console.log('============================================================\n');

  // Start backend server
  const { server } = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/dist/backend/src/server.js');
  await new Promise((resolve) => {
    server.listen(PORT, resolve);
  });
  console.log(`Backend analytics test server listening on port ${PORT}.\n`);

  let adminToken = '';
  let facultyToken = '';
  let assistantToken = '';

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Authentication
    // ------------------------------------------------------------------------
    console.log('--- SECTION 1: Authentication ---');
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

    // ------------------------------------------------------------------------
    // SECTION 2: General Analytics Dashboard Structure
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: General Analytics Dashboard Metrics ---');
    const dashRes = await request({
      method: 'GET',
      path: '/api/analytics/dashboard',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(dashRes.status === 200 && dashRes.body.success, 'GET /api/analytics/dashboard returns HTTP 200');
    const data = dashRes.body.data;

    // Verify Utilization
    assert(typeof data.utilization.totalSessions === 'number', 'Utilization contains totalSessions number');
    assert(typeof data.utilization.totalDurationHours === 'number', 'Utilization contains totalDurationHours number');
    assert(typeof data.utilization.avgSessionMinutes === 'number', 'Utilization contains avgSessionMinutes number');
    assert(typeof data.utilization.activeOccupancyPercent === 'number', 'Utilization contains activeOccupancyPercent');
    assert(typeof data.utilization.peakHour === 'string', 'Utilization contains peakHour indicator');
    assert(Array.isArray(data.utilization.hourlyDistribution), 'Utilization contains hourlyDistribution array');
    assert(data.utilization.hourlyDistribution.length === 24, 'hourlyDistribution contains exactly 24 hour buckets (0 to 23)');

    // Verify Issues
    assert(typeof data.issues.totalReported === 'number', 'Issues contains totalReported count');
    assert(typeof data.issues.openCount === 'number', 'Issues contains openCount');
    assert(typeof data.issues.resolvedCount === 'number', 'Issues contains resolvedCount');
    assert(typeof data.issues.resolutionRatePercent === 'number', 'Issues contains resolutionRatePercent');
    assert(Array.isArray(data.issues.categoryBreakdown), 'Issues contains categoryBreakdown array');

    // Verify Maintenance
    assert(typeof data.maintenance.totalOrders === 'number', 'Maintenance contains totalOrders count');
    assert(typeof data.maintenance.inProgressCount === 'number', 'Maintenance contains inProgressCount');
    assert(typeof data.maintenance.completedCount === 'number', 'Maintenance contains completedCount');
    assert(typeof data.maintenance.totalCost === 'number', 'Maintenance contains totalCost number');
    assert(typeof data.maintenance.avgRepairCost === 'number', 'Maintenance contains avgRepairCost number');

    // Verify Fleet Health
    assert(typeof data.fleetHealth.totalWorkstations === 'number', 'Fleet contains totalWorkstations count');
    assert(typeof data.fleetHealth.onlineCount === 'number', 'Fleet contains onlineCount');
    assert(typeof data.fleetHealth.offlineCount === 'number', 'Fleet contains offlineCount');
    assert(typeof data.fleetHealth.onlinePercentage === 'number', 'Fleet contains onlinePercentage');

    // Verify Empty State Flags
    assert(typeof data.emptyStates.hasSessions === 'boolean', 'Contains hasSessions boolean flag');
    assert(typeof data.emptyStates.hasIssues === 'boolean', 'Contains hasIssues boolean flag');
    assert(typeof data.emptyStates.hasMaintenance === 'boolean', 'Contains hasMaintenance boolean flag');
    assert(typeof data.emptyStates.hasFleet === 'boolean', 'Contains hasFleet boolean flag');

    // ------------------------------------------------------------------------
    // SECTION 3: Timeframe Filters (7d, 30d, 90d, all)
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Timeframe Filtering Logic ---');
    const tf7 = await request({
      method: 'GET',
      path: '/api/analytics/dashboard?timeframe=7d',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(tf7.status === 200 && tf7.body.data.timeframe === '7d', 'timeframe=7d accepted and returned');

    const tf90 = await request({
      method: 'GET',
      path: '/api/analytics/dashboard?timeframe=90d',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(tf90.status === 200 && tf90.body.data.timeframe === '90d', 'timeframe=90d accepted and returned');

    const tfall = await request({
      method: 'GET',
      path: '/api/analytics/dashboard?timeframe=all',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(tfall.status === 200 && tfall.body.data.timeframe === 'all', 'timeframe=all accepted and returned');

    // ------------------------------------------------------------------------
    // SECTION 4: Facility / Lab Scoping & Filtering
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Facility Scoping & Scoped Analytics ---');
    const lab1Res = await request({
      method: 'GET',
      path: '/api/analytics/dashboard?labCode=LAB-01',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(lab1Res.status === 200 && lab1Res.body.data.labCode === 'LAB-01', 'labCode=LAB-01 filtered analytics returned');

    // Assistant allowed for assigned lab
    const asstAllowedRes = await request({
      method: 'GET',
      path: '/api/analytics/dashboard?labCode=LAB-01',
      headers: { Authorization: `Bearer ${assistantToken}` }
    });
    assert(asstAllowedRes.status === 200, 'Assistant allowed to view analytics for assigned lab LAB-01');

    // Assistant forbidden for unassigned lab
    const asstBlockedRes = await request({
      method: 'GET',
      path: '/api/analytics/dashboard?labCode=UNASSIGNED-LAB-99',
      headers: { Authorization: `Bearer ${assistantToken}` }
    });
    assert(asstBlockedRes.status === 403, 'Assistant blocked from unassigned facility analytics with HTTP 403');

    // ------------------------------------------------------------------------
    // SECTION 5: Zero Mock / True Empty State Integrity
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Zero Mock / True Empty State Integrity ---');
    // Check that empty hourly slots have count === 0, not NaN or undefined or fake numbers
    const hourlyZeroValid = data.utilization.hourlyDistribution.every(
      (h) => typeof h.sessionCount === 'number' && !isNaN(h.sessionCount) && h.sessionCount >= 0
    );
    assert(hourlyZeroValid, 'All 24 hourly distribution counts are valid non-NaN integers');

    // Check that categories have valid percentages (0-100) and no NaN
    const categoriesValid = data.issues.categoryBreakdown.every(
      (c) => typeof c.percentage === 'number' && !isNaN(c.percentage) && c.percentage >= 0 && c.percentage <= 100
    );
    assert(categoriesValid, 'All issue categories have valid non-NaN percentages');

    // If totalCost is 0, avgRepairCost is 0, never NaN
    if (data.maintenance.totalOrders === 0) {
      assert(data.maintenance.avgRepairCost === 0, 'When total orders is 0, avgRepairCost is cleanly 0 (no division by zero NaN)');
    } else {
      assert(!isNaN(data.maintenance.avgRepairCost), 'avgRepairCost is a valid number');
    }
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
