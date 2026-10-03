// ============================================================================
// LABGUARD V2 — PHASE 17: NOTIFICATIONS & TELEMETRY TEST SUITE
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
          resolve({ status: res.statusCode, headers: res.headers, body: json });
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
  console.log('LABGUARD V2 — PHASE 17: NOTIFICATIONS TEST SUITE');
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
    assert(stuLogin.status === 200, 'Student 1 logs in successfully');
    const stuToken = stuLogin.body?.data?.accessToken;
    const stu1Id = stuLogin.body?.data?.user?.id;

    let stu2Token;
    let stu2Id;
    let stu2Login = await request({
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
      stu2Id = stu2Login.body?.data?.user?.id;
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
      stu2Login = await request({
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
      stu2Token = stu2Login.body?.data?.accessToken;
      stu2Id = stu2Login.body?.data?.user?.id;
    }
    assert(stu2Login.status === 200, 'Student 2 logs in successfully');

    // ------------------------------------------------------------------------
    // SECTION 2: Role & System Notification Dispatch
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Targeted Notification Dispatch ---');
    // 1. Dispatch notification targeted to LAB_ASSISTANT
    const astNotifRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      title: 'Lab 01 Routine Inspection',
      message: 'Please conduct morning inventory check on Turing Lab.',
      severity: 'INFO',
      eventType: 'STAFF_INSPECTION',
      targetRole: 'LAB_ASSISTANT',
      labCode: 'LAB-01'
    });
    assert(astNotifRes.status === 201, 'Assistant notification dispatched (HTTP 201)');
    const astNotifId = astNotifRes.body?.data?.id;
    assert(!!astNotifId, 'Assistant notification ID generated');

    // 2. Dispatch notification targeted to STUDENT
    const stuNotifRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      title: 'Lab Hours Extension',
      message: 'Lab facilities will remain open until 9:00 PM today.',
      severity: 'INFO',
      eventType: 'HOURS_EXTENSION',
      targetRole: 'STUDENT'
    });
    assert(stuNotifRes.status === 201, 'Student broadcast notification dispatched (HTTP 201)');
    const stuBroadcastId = stuNotifRes.body?.data?.id;

    // 3. Dispatch direct private notification to Student 1
    const directNotifRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      title: 'Personal Session Notice',
      message: 'Your practical assignment submission has been acknowledged.',
      severity: 'INFO',
      eventType: 'ACADEMIC_NOTICE',
      targetUserId: stu1Id
    });
    assert(directNotifRes.status === 201, 'Direct student notification dispatched (HTTP 201)');
    const directNotifId = directNotifRes.body?.data?.id;

    // 4. Global institutional announcement
    const globalRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      title: 'Campus Network Maintenance',
      message: 'Core switches undergoing firmware upgrade at midnight.',
      severity: 'WARNING',
      eventType: 'INFRASTRUCTURE_MAINTENANCE'
    });
    assert(globalRes.status === 201, 'Global announcement dispatched (HTTP 201)');
    const globalNotifId = globalRes.body?.data?.id;

    // ------------------------------------------------------------------------
    // SECTION 3: Role-Aware Scoping & Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Role Scoping & User Isolation ---');
    // Assistant checks notifications
    const astFetch = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'GET',
      headers: { Authorization: `Bearer ${astToken}` }
    });
    assert(astFetch.status === 200, 'Assistant fetches notifications (HTTP 200)');
    const astItems = astFetch.body?.data || [];
    assert(astItems.some((n) => n.id === astNotifId), 'Assistant receives assistant-targeted notification');
    assert(astItems.some((n) => n.id === globalNotifId), 'Assistant receives global institutional announcement');
    assert(!astItems.some((n) => n.id === stuBroadcastId), 'Assistant DOES NOT receive student-role broadcast');
    assert(!astItems.some((n) => n.id === directNotifId), 'Assistant DOES NOT receive student direct private notification');

    // Student 1 checks notifications
    const stu1Fetch = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(stu1Fetch.status === 200, 'Student 1 fetches notifications (HTTP 200)');
    const stu1Items = stu1Fetch.body?.data || [];
    assert(stu1Items.some((n) => n.id === stuBroadcastId), 'Student 1 receives student-role broadcast');
    assert(stu1Items.some((n) => n.id === directNotifId), 'Student 1 receives their own direct private notification');
    assert(stu1Items.some((n) => n.id === globalNotifId), 'Student 1 receives global institutional announcement');
    assert(!stu1Items.some((n) => n.id === astNotifId), 'Student 1 DOES NOT receive assistant notification');

    // Student 2 checks notifications
    const stu2Fetch = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'GET',
      headers: { Authorization: `Bearer ${stu2Token}` }
    });
    assert(stu2Fetch.status === 200, 'Student 2 fetches notifications (HTTP 200)');
    const stu2Items = stu2Fetch.body?.data || [];
    assert(stu2Items.some((n) => n.id === stuBroadcastId), 'Student 2 receives student-role broadcast');
    assert(!stu2Items.some((n) => n.id === directNotifId), 'Student 2 CANNOT view Student 1 private notification');

    // Admin checks notifications (Institutional oversight)
    const admFetch = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(admFetch.status === 200, 'Admin fetches all notifications (HTTP 200)');
    const admItems = admFetch.body?.data || [];
    assert(admItems.some((n) => n.id === astNotifId), 'Admin has oversight of assistant notification');
    assert(admItems.some((n) => n.id === stuBroadcastId), 'Admin has oversight of student notification');

    // ------------------------------------------------------------------------
    // SECTION 4: Deduplication & Anti-Flooding Cooldown
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Deduplication & Anti-Flooding Engine ---');
    // Dispatch duplicate non-critical alert immediately with identical keys
    const dupRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      title: 'Lab 01 Routine Inspection',
      message: 'Please conduct morning inventory check on Turing Lab.',
      severity: 'INFO',
      eventType: 'STAFF_INSPECTION',
      targetRole: 'LAB_ASSISTANT',
      labCode: 'LAB-01'
    });
    assert(dupRes.status === 201, 'Duplicate request processed (HTTP 201)');
    assert(dupRes.body?.data === null, 'Identical non-critical notification suppressed during cooldown');

    // Critical notification bypasses cooldown
    const critRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      title: 'FIRE ALARM TEST',
      message: 'Immediate evacuation drill in progress.',
      severity: 'CRITICAL',
      eventType: 'EMERGENCY_EVACUATION'
    });
    assert(critRes.status === 201, 'Critical alert processed (HTTP 201)');
    assert(critRes.body?.data !== null, 'CRITICAL severity alert bypasses cooldown filter');
    const critNotifId = critRes.body?.data?.id;

    // ------------------------------------------------------------------------
    // SECTION 5: Read State Progression & Unread Telemetry
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Read State Progression & Badge Telemetry ---');
    // Query badge count for Student 1
    const badge1 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications/badge',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(badge1.status === 200, 'GET /api/notifications/badge returns HTTP 200');
    assert(badge1.body?.data?.unread >= 3, 'Unread count is at least 3');
    assert(badge1.body?.data?.criticalUnread >= 1, 'Critical unread count is at least 1');

    // Mark single notification as read
    const readSingleRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/notifications/${directNotifId}/read`,
      method: 'PATCH',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(readSingleRes.status === 200, 'Mark single notification as read (HTTP 200)');

    // Verify unread count decremented
    const badge2 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications/badge',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(badge2.body?.data?.unread === badge1.body?.data?.unread - 1, 'Unread count correctly decremented by 1');

    // Mark all as read for Student 1
    const readAllRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications/read-all',
      method: 'POST',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(readAllRes.status === 200, 'POST /api/notifications/read-all returns HTTP 200');
    assert(readAllRes.body?.count >= 2, 'Multiple unread notifications marked as read');

    // Verify unread count is now 0 for Student 1
    const badge3 = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications/badge',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(badge3.body?.data?.unread === 0, 'Unread count for Student 1 is now 0');

    // ------------------------------------------------------------------------
    // SECTION 6: Query Filtering & Notification Dismissal
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Query Filtering & Notification Dismissal ---');
    // Filter by severity=CRITICAL
    const critFilter = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications?severity=CRITICAL',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(critFilter.status === 200, 'Filter by severity=CRITICAL returns HTTP 200');
    assert(critFilter.body?.data?.every((n) => n.severity === 'CRITICAL'), 'All returned items have CRITICAL severity');

    // Delete single notification
    const delRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/notifications/${directNotifId}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(delRes.status === 200, 'DELETE /api/notifications/:id returns HTTP 200');

    // Verify deleted notification no longer in list
    const stu1Recheck = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(!stu1Recheck.body?.data?.some((n) => n.id === directNotifId), 'Dismissed notification permanently removed');

    // ------------------------------------------------------------------------
    // SECTION 7: Notification Preferences Engine
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 7: User Notification Preferences ---');
    // Get default preferences
    const prefGet = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications/preferences',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(prefGet.status === 200, 'GET /api/notifications/preferences returns HTTP 200');
    assert(prefGet.body?.data?.criticalOnly === false, 'Default criticalOnly preference is false');
    assert(prefGet.body?.data?.hardwareAlerts === true, 'Default hardwareAlerts preference is true');

    // Update preferences to criticalOnly = true
    const prefUpdate = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications/preferences',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, {
      criticalOnly: true,
      hardwareAlerts: false
    });
    assert(prefUpdate.status === 200, 'PATCH /api/notifications/preferences returns HTTP 200');
    assert(prefUpdate.body?.data?.criticalOnly === true, 'criticalOnly preference updated to true');

    // Dispatch non-critical notification directly to Student 1
    const suppNotif = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      title: 'Low Priority Advisory',
      message: 'Campus cafe closes 15 minutes early.',
      severity: 'INFO',
      eventType: 'CAFE_HOURS',
      targetUserId: stu1Id
    });
    assert(suppNotif.status === 201, 'Notification request handled (HTTP 201)');
    assert(suppNotif.body?.data === null, 'Non-critical notification suppressed by user preference');

    // Dispatch CRITICAL notification to Student 1
    const allowedCrit = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, {
      title: 'URGENT SECURITY ALERT',
      message: 'Please change password immediately.',
      severity: 'CRITICAL',
      eventType: 'SECURITY_ALERT',
      targetUserId: stu1Id
    });
    assert(allowedCrit.status === 201, 'Critical notification handled (HTTP 201)');
    assert(allowedCrit.body?.data !== null, 'CRITICAL alert delivered despite criticalOnly preference');

    // ------------------------------------------------------------------------
    // SECTION 8: Strict Anti-Escalation RBAC Protections
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 8: Anti-Escalation RBAC Protections ---');
    // Student attempts to broadcast system notification
    const stuBroadcastAttempt = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, {
      title: 'Fake Notification',
      message: 'Classes cancelled today.',
      severity: 'INFO',
      eventType: 'CANCEL_CLASSES'
    });
    assert(stuBroadcastAttempt.status === 403, 'Student cannot dispatch notifications (HTTP 403 Forbidden)');

    // Faculty attempts to broadcast system notification
    const facBroadcastAttempt = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facToken}`
      }
    }, {
      title: 'Faculty Broadcast',
      message: 'All students come to lab.',
      severity: 'INFO',
      eventType: 'FACULTY_BROADCAST'
    });
    assert(facBroadcastAttempt.status === 403, 'Faculty cannot dispatch notifications (HTTP 403 Forbidden)');

    // Student 2 attempts to mark another user's private notification as read
    const crossReadAttempt = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/notifications/${allowedCrit.body?.data?.id}/read`,
      method: 'PATCH',
      headers: { Authorization: `Bearer ${stu2Token}` }
    });
    assert(crossReadAttempt.status === 404, 'Student 2 blocked from marking Student 1 notification as read (HTTP 404/Forbidden)');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('\nBackend test server stopped.');
  }

  console.log('\n============================================================');
  console.log(`PHASE 17 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
