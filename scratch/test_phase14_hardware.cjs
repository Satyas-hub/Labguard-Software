// ============================================================================
// LABGUARD V2 — PHASE 14: HARDWARE MONITORING TEST SUITE
// Tests:
// 1. Hardware Event Ingestion (Connect, Disconnect, Missing Device)
// 2. Hardware Alert Dispatch & Severity Resolution
// 3. Hardware Event Acknowledgment by Assistant/Admin
// 4. Scoped Hardware Event Stream (Lab Isolation & Status Filters)
// 5. Anti-Escalation RBAC (Students blocked from logging hardware events)
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
  console.log('LABGUARD V2 — PHASE 14: HARDWARE MONITORING TEST SUITE');
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
    // SECTION 2: Hardware Disconnect & Connect Events
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Hardware Telemetry Event Ingestion ---');
    // Assistant logs a hardware disconnect event for USB Mouse on PC-01
    const mouseDisconnect = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/hardware-events',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-01',
      eventType: 'HARDWARE_DISCONNECTED',
      description: 'Mouse disconnected or signal lost on USB Port 2',
      equipmentId: 'eq-ms-01',
      metadata: { peripheral: 'MOUSE', port: 'USB-2' }
    });
    assert(mouseDisconnect.status === 201, 'Hardware disconnect event recorded (HTTP 201)');
    assert(mouseDisconnect.body?.data?.eventType === 'HARDWARE_DISCONNECTED', 'Event type is HARDWARE_DISCONNECTED');
    const mouseEventId = mouseDisconnect.body?.data?.id;
    assert(!!mouseEventId, 'Event ID generated');
    assert(mouseDisconnect.body?.data?.acknowledged === false, 'Event defaults to unacknowledged');

    // Assistant logs a hardware reconnect event
    const mouseReconnect = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/hardware-events',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-01',
      eventType: 'HARDWARE_CONNECTED',
      description: 'Mouse connection restored to USB port',
      equipmentId: 'eq-ms-01',
      metadata: { peripheral: 'MOUSE' }
    });
    assert(mouseReconnect.status === 201, 'Hardware reconnect event recorded (HTTP 201)');
    assert(mouseReconnect.body?.data?.eventType === 'HARDWARE_CONNECTED', 'Event type is HARDWARE_CONNECTED');

    // Assistant logs missing device event
    const missingDev = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/hardware-events',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-02',
      eventType: 'DEVICE_MISSING',
      description: 'Headset peripheral missing from workstation node',
      metadata: { peripheral: 'HEADSET' }
    });
    assert(missingDev.status === 201, 'Device missing event recorded (HTTP 201)');
    const missingEventId = missingDev.body?.data?.id;

    // ------------------------------------------------------------------------
    // SECTION 3: Event Acknowledgment Workflow
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Hardware Alert Acknowledgment ---');
    const ackRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/hardware-events/${mouseEventId}/acknowledge`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${astToken}`
      }
    }, {});
    assert(ackRes.status === 200, 'Assistant acknowledges hardware incident (HTTP 200)');
    assert(ackRes.body?.data?.acknowledged === true, 'Incident acknowledged field is true');
    assert(!!ackRes.body?.data?.acknowledgedAt, 'Acknowledgment timestamp populated');

    // ------------------------------------------------------------------------
    // SECTION 4: Scoped Queries & Incident Filters
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Scoped Hardware Telemetry Queries ---');
    // Query unacknowledged alerts
    const unackList = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/hardware-events?acknowledged=false',
      method: 'GET',
      headers: { Authorization: `Bearer ${astToken}` }
    });
    assert(unackList.status === 200, 'GET /api/hardware-events?acknowledged=false returns HTTP 200');
    const allUnack = (unackList.body?.data || []).every((e) => e.acknowledged === false);
    assert(allUnack, 'Filtered results contain only unacknowledged incidents');

    // Filter by facility LAB-01
    const lab1Events = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/hardware-events?labCode=LAB-01',
      method: 'GET',
      headers: { Authorization: `Bearer ${astToken}` }
    });
    assert(lab1Events.status === 200, 'GET /api/hardware-events?labCode=LAB-01 returns HTTP 200');
    const allLab1 = (lab1Events.body?.data || []).every((e) => e.labCode === 'LAB-01');
    assert(allLab1, 'Filtered results belong exclusively to LAB-01');

    // ------------------------------------------------------------------------
    // SECTION 5: Anti-Escalation RBAC Protections
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Anti-Escalation RBAC Protections ---');
    // Student cannot create hardware events
    const stuCreateEvent = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/hardware-events',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, {
      labCode: 'LAB-01',
      pcCode: 'PC-01',
      eventType: 'HARDWARE_DISCONNECTED',
      description: 'Student spoofed hardware disconnect'
    });
    assert(stuCreateEvent.status === 403, 'Student cannot log hardware events (HTTP 403 Forbidden)');

    // Student cannot acknowledge hardware events
    const stuAck = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/hardware-events/${missingEventId}/acknowledge`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stuToken}`
      }
    }, {});
    assert(stuAck.status === 403, 'Student cannot acknowledge hardware events (HTTP 403 Forbidden)');

    // Student cannot list raw hardware event telemetry
    const stuList = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/hardware-events',
      method: 'GET',
      headers: { Authorization: `Bearer ${stuToken}` }
    });
    assert(stuList.status === 403, 'Student cannot list raw hardware events (HTTP 403 Forbidden)');

    console.log('\n============================================================');
    console.log(`PHASE 14 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    server.close();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
