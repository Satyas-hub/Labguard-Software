// ============================================================================
// LABGUARD V2 — PHASE 21: LIVE LAB MONITORING TEST SUITE
// Tests WebSocket gateway connectivity, room scoping, dynamic telemetry broadcasts,
// session lifecycle push notifications, and hardware/issue real-time alerts.
// ============================================================================

const http = require('http');
const WebSocket = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/node_modules/ws');

const PORT = 5001; // use separate port for test isolation
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

function waitForMessage(ws, filterFn, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMsg);
      reject(new Error(`Timeout waiting for WebSocket message after ${timeoutMs}ms`));
    }, timeoutMs);

    function onMsg(raw) {
      try {
        const parsed = JSON.parse(raw.toString());
        if (!filterFn || filterFn(parsed)) {
          clearTimeout(timer);
          ws.off('message', onMsg);
          resolve(parsed);
        }
      } catch (err) {
        // Ignore unparseable frames
      }
    }

    ws.on('message', onMsg);
  });
}

async function runTests() {
  console.log('============================================================');
  console.log('LABGUARD V2 — PHASE 21: LIVE LAB MONITORING TEST SUITE');
  console.log('============================================================\n');

  // Start backend server
  const { server } = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/dist/backend/src/server.js');
  const { RealtimeService } = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/dist/backend/src/services/realtimeService.js');

  await new Promise((resolve) => {
    server.listen(PORT, resolve);
  });
  console.log(`Backend monitoring test server listening on port ${PORT}.\n`);

  let adminToken = '';
  let assistantToken = '';
  let studentToken = '';

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Authentication & Client Setup
    // ------------------------------------------------------------------------
    console.log('--- SECTION 1: User Logins for Monitoring Test ---');
    const adminLogin = await request(
      { method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' } },
      { identifier: 'admin@labguard.edu', password: 'Admin@123456', role: 'ADMIN' }
    );
    assert(adminLogin.status === 200 && adminLogin.body.data.accessToken, 'Admin login succeeded');
    adminToken = adminLogin.body.data.accessToken;

    const asstLogin = await request(
      { method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' } },
      { identifier: 'assistant@labguard.edu', password: 'Assistant@123456', role: 'LAB_ASSISTANT' }
    );
    assert(asstLogin.status === 200 && asstLogin.body.data.accessToken, 'Assistant login succeeded');
    assistantToken = asstLogin.body.data.accessToken;

    const studentLogin = await request(
      { method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' } },
      { identifier: 'student@labguard.edu', password: 'Student@123456', role: 'STUDENT' }
    );
    assert(studentLogin.status === 200 && studentLogin.body.data.accessToken, 'Student login succeeded');
    studentToken = studentLogin.body.data.accessToken;

    // ------------------------------------------------------------------------
    // SECTION 2: WebSocket Connection Handshake & Heartbeat
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: WebSocket Connection Handshake & Heartbeat ---');
    const wsClient1 = new WebSocket(`ws://localhost:${PORT}/ws`);

    const welcomeMsg = await waitForMessage(wsClient1, (m) => m.type === 'CONNECTED');
    assert(welcomeMsg && welcomeMsg.type === 'CONNECTED', 'Client received CONNECTED handshake');
    assert(welcomeMsg.message.includes('LABGUARD Realtime Gateway Active'), 'Welcome banner confirmed active');

    // Test PING / PONG
    const pongPromise = waitForMessage(wsClient1, (m) => m.type === 'PONG');
    wsClient1.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
    const pongMsg = await pongPromise;
    assert(pongMsg && pongMsg.type === 'PONG', 'PING received corresponding PONG frame');
    assert(typeof pongMsg.timestamp === 'number', 'PONG contains valid timestamp');

    // ------------------------------------------------------------------------
    // SECTION 3: Scoped Room Subscriptions
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Scoped Room Subscriptions ---');
    const subPromise1 = waitForMessage(wsClient1, (m) => m.type === 'SUBSCRIPTION_CONFIRMED');
    wsClient1.send(JSON.stringify({
      type: 'SUBSCRIBE',
      labCode: 'LAB-01',
      role: 'LAB_ASSISTANT'
    }));
    const sub1 = await subPromise1;
    assert(sub1 && sub1.labCode === 'LAB-01', 'Client 1 confirmed subscription to LAB-01');

    // Connect a second client scoped to LAB-02
    const wsClient2 = new WebSocket(`ws://localhost:${PORT}/ws`);
    await waitForMessage(wsClient2, (m) => m.type === 'CONNECTED');
    const subPromise2 = waitForMessage(wsClient2, (m) => m.type === 'SUBSCRIPTION_CONFIRMED');
    wsClient2.send(JSON.stringify({
      type: 'SUBSCRIBE',
      labCode: 'LAB-02',
      role: 'FACULTY'
    }));
    const sub2 = await subPromise2;
    assert(sub2 && sub2.labCode === 'LAB-02', 'Client 2 confirmed subscription to LAB-02');

    // ------------------------------------------------------------------------
    // SECTION 4: Room Scoping Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Room Scoping Isolation ---');
    let client2ReceivedUnintended = false;
    const client2UnintendedHandler = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'TEST_ISOLATION') {
        client2ReceivedUnintended = true;
      }
    };
    wsClient2.on('message', client2UnintendedHandler);

    const client1ReceivedPromise = waitForMessage(wsClient1, (m) => m.type === 'TEST_ISOLATION');
    RealtimeService.broadcast('TEST_ISOLATION', { note: 'Lab 01 Only' }, 'LAB-01');
    const client1Received = await client1ReceivedPromise;
    assert(client1Received && client1Received.data.note === 'Lab 01 Only', 'Client 1 received LAB-01 target broadcast');

    // Wait 200ms to verify Client 2 did NOT receive
    await new Promise((r) => setTimeout(r, 200));
    assert(!client2ReceivedUnintended, 'Client 2 in LAB-02 was properly isolated from LAB-01 broadcast');
    wsClient2.off('message', client2UnintendedHandler);

    // Broadcast to ALL
    const c1AllPromise = waitForMessage(wsClient1, (m) => m.type === 'TEST_ALL');
    const c2AllPromise = waitForMessage(wsClient2, (m) => m.type === 'TEST_ALL');
    RealtimeService.broadcast('TEST_ALL', { note: 'Facility-wide announcement' });
    const [c1All, c2All] = await Promise.all([c1AllPromise, c2AllPromise]);
    assert(c1All && c2All, 'Both clients received universal broadcast without lab target');

    // ------------------------------------------------------------------------
    // SECTION 5: Workstation State Broadcasts
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Workstation State Broadcasts ---');
    const pcStatePromise = waitForMessage(wsClient1, (m) => m.type === 'WORKSTATION_STATE_CHANGED');
    
    // Trigger state change via REST PATCH /api/computers/:id/state
    const statePatchRes = await request(
      {
        method: 'PATCH',
        path: '/api/computers/PC-01/state',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      },
      { state: 'MAINTENANCE', reason: 'Live fleet monitoring benchmark test' }
    );
    assert(statePatchRes.status === 200, 'Workstation state patched to MAINTENANCE via REST API');

    const pcStateEvent = await pcStatePromise;
    assert(pcStateEvent && pcStateEvent.type === 'WORKSTATION_STATE_CHANGED', 'Received WORKSTATION_STATE_CHANGED frame');
    assert(pcStateEvent.data.pcCode === 'PC-01', 'Event identifies correct workstation PC-01');
    assert(pcStateEvent.data.state === 'MAINTENANCE', 'Event reports state transitioned to MAINTENANCE');

    // Restore PC-01 to AVAILABLE
    await request(
      {
        method: 'PATCH',
        path: '/api/computers/PC-01/state',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      },
      { state: 'AVAILABLE' }
    );

    // ------------------------------------------------------------------------
    // SECTION 6: Live Student Session Lifecycle Broadcasts
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Live Student Session Lifecycle Broadcasts ---');
    const sessStartPromise = waitForMessage(wsClient1, (m) => m.type === 'SESSION_STARTED');

    // Start session as student
    const sessionStartRes = await request(
      {
        method: 'POST',
        path: '/api/sessions/start',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        }
      },
      {
        labCode: 'LAB-01',
        pcCode: 'PC-01',
        clientId: 'CLIENT-PC-01'
      }
    );
    assert(sessionStartRes.status === 201, 'Student session initiated successfully');
    const sessionId = sessionStartRes.body.data.id;

    const sessStartEvent = await sessStartPromise;
    assert(sessStartEvent && sessStartEvent.type === 'SESSION_STARTED', 'Received SESSION_STARTED broadcast event');
    assert(sessStartEvent.data.id === sessionId, 'Session ID matches created session');
    assert(sessStartEvent.data.pcCode === 'PC-01', 'Workstation PC-01 reported in active session');

    // End session
    const sessEndPromise = waitForMessage(wsClient1, (m) => m.type === 'SESSION_ENDED');
    const sessionEndRes = await request(
      {
        method: 'POST',
        path: `/api/sessions/${sessionId}/end`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        }
      },
      { endMode: 'NORMAL' }
    );
    assert(sessionEndRes.status === 200, 'Student session ended successfully');

    const sessEndEvent = await sessEndPromise;
    assert(sessEndEvent && sessEndEvent.type === 'SESSION_ENDED', 'Received SESSION_ENDED broadcast event');
    assert(sessEndEvent.data.id === sessionId, 'Session ID confirmed closed');

    // ------------------------------------------------------------------------
    // SECTION 7: Hardware & Maintenance Real-Time Alerts
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 7: Hardware & Maintenance Real-Time Alerts ---');
    const hwPromise = waitForMessage(wsClient1, (m) => m.type === 'HARDWARE_ALERT');

    // Log hardware peripheral event
    const hwRes = await request(
      {
        method: 'POST',
        path: '/api/hardware-events',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${assistantToken}`
        }
      },
      {
        labCode: 'LAB-01',
        pcCode: 'PC-01',
        eventType: 'KEYBOARD_DISCONNECTED',
        description: 'Mechanical keyboard USB line severed'
      }
    );
    assert(hwRes.status === 201, 'Hardware event logged via Assistant API');

    const hwEvent = await hwPromise;
    assert(hwEvent && hwEvent.type === 'HARDWARE_ALERT', 'Received HARDWARE_ALERT broadcast frame');
    assert(hwEvent.data.eventType === 'KEYBOARD_DISCONNECTED', 'Alert details confirmed accurate');

    // Test Issue Lifecycle Broadcast
    const issueReportPromise = waitForMessage(wsClient1, (m) => m.type === 'ISSUE_REPORTED');
    const issueRes = await request(
      {
        method: 'POST',
        path: '/api/issues',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        }
      },
      {
        labCode: 'LAB-01',
        pcCode: 'PC-01',
        title: 'Monitor flickering in high refresh mode',
        category: 'DISPLAY',
        severity: 'MEDIUM'
      }
    );
    assert(issueRes.status === 201, 'Issue reported via Student API');
    const reportedIssueId = issueRes.body.data.id;

    const issueReportEvent = await issueReportPromise;
    assert(issueReportEvent && issueReportEvent.type === 'ISSUE_REPORTED', 'Received ISSUE_REPORTED broadcast');
    assert(issueReportEvent.data.id === reportedIssueId, 'Issue ID matches reported incident');

    // Test Issue Update Broadcast
    const issueUpdPromise = waitForMessage(wsClient1, (m) => m.type === 'ISSUE_UPDATED');
    const updateRes = await request(
      {
        method: 'PATCH',
        path: `/api/issues/${reportedIssueId}/status`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${assistantToken}`
        }
      },
      {
        status: 'VERIFIED',
        resolutionNotes: 'Confirmed display cable degradation'
      }
    );
    assert(updateRes.status === 200, 'Issue status transitioned to VERIFIED');

    const issueUpdEvent = await issueUpdPromise;
    assert(issueUpdEvent && issueUpdEvent.type === 'ISSUE_UPDATED', 'Received ISSUE_UPDATED broadcast');
    assert(issueUpdEvent.data.status === 'VERIFIED', 'Issue status confirmed VERIFIED in payload');

    // Clean up connections
    wsClient1.close();
    wsClient2.close();
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
