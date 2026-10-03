// ============================================================================
// LABGUARD V2 — PHASE 20: SYNCHRONIZATION ENGINE TEST SUITE
// Tests idempotent client-to-server batch synchronization, conflict detection,
// exponential backoff retry logic, and server timestamp reconciliation.
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
  console.log('LABGUARD V2 — PHASE 20: SYNCHRONIZATION ENGINE TEST SUITE');
  console.log('============================================================\n');

  // Start backend in-process by loading compiled server
  const { server } = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/dist/backend/src/server.js');
  await new Promise((resolve) => {
    server.listen(PORT, resolve);
  });
  console.log(`Backend test server listening on port ${PORT}.\n`);

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Authentication & Sync API Endpoint Security
    // ------------------------------------------------------------------------
    console.log('--- SECTION 1: Authentication & Sync API Security ---');

    // Attempt unauthenticated sync request -> 401
    const unauthSync = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sync/batch',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { clientId: 'CLIENT-01', batchId: 'batch-01' });
    assert(unauthSync.status === 401, 'Unauthenticated /api/sync/batch request rejected with HTTP 401');

    // Authenticate as Student
    const studentLogin = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identifier: 'student@labguard.edu', password: 'Student@123456', role: 'STUDENT' });
    assert(studentLogin.status === 200 && studentLogin.body.success, 'Student login returns HTTP 200');
    const studentToken = studentLogin.body.data.accessToken;

    // Authenticate as Assistant
    const astLogin = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identifier: 'assistant@labguard.edu', password: 'Assistant@123456', role: 'LAB_ASSISTANT' });
    assert(astLogin.status === 200, 'Assistant login returns HTTP 200');
    const assistantToken = astLogin.body.data.accessToken;

    // ------------------------------------------------------------------------
    // SECTION 2: Batch Synchronization API Transmission
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Batch Synchronization API Transmission ---');

    const sampleBatchPayload = {
      clientId: 'CLIENT-PC01',
      batchId: 'batch-sync-test-01',
      timestamp: new Date().toISOString(),
      sessions: [
        {
          id: 'session-offline-01',
          studentId: studentLogin.body.data.user.id,
          studentName: 'Offline Student',
          studentIdentifier: 'STU-1001',
          labCode: 'LAB-01',
          pcCode: 'PC-01',
          clientId: 'CLIENT-PC01',
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          endedAt: new Date().toISOString(),
          status: 'COMPLETED',
          endMode: 'MANUAL',
          syncStatus: 'PENDING'
        }
      ],
      hardwareEvents: [
        {
          id: 'hw-event-offline-01',
          clientId: 'CLIENT-PC01',
          labCode: 'LAB-01',
          pcCode: 'PC-01',
          eventType: 'HARDWARE_CONNECTED',
          description: 'USB Mouse reconnected during offline session',
          severity: 'INFO',
          timestamp: new Date().toISOString(),
          syncStatus: 'PENDING'
        }
      ],
      issues: [
        {
          id: 'issue-offline-01',
          labCode: 'LAB-01',
          pcCode: 'PC-01',
          reportedBy: studentLogin.body.data.user.id,
          issueType: 'Mouse Problem',
          description: 'Mouse scroll wheel skipping',
          status: 'OPEN',
          severity: 'MEDIUM',
          createdAt: new Date().toISOString()
        }
      ],
      maintenance: [
        {
          id: 'maint-offline-01',
          labCode: 'LAB-01',
          pcCode: 'PC-01',
          issueId: 'issue-offline-01',
          responsibleUser: astLogin.body.data.user.id,
          actionTaken: 'Cleaned optical lens',
          status: 'COMPLETED',
          startTime: new Date(Date.now() - 1800000).toISOString(),
          endTime: new Date().toISOString(),
          cost: 0
        }
      ],
      auditLogs: [
        {
          id: 'audit-offline-01',
          actorUserId: studentLogin.body.data.user.id,
          actorName: 'Offline Student',
          role: 'STUDENT',
          action: 'SESSION_START_OFFLINE',
          entityType: 'SESSION',
          entityId: 'session-offline-01',
          timestamp: new Date().toISOString()
        }
      ]
    };

    const syncRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sync/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      }
    }, sampleBatchPayload);

    assert(syncRes.status === 200 && syncRes.body.success, 'POST /api/sync/batch returns HTTP 200');
    assert(syncRes.body.data.batchId === 'batch-sync-test-01', 'Response contains matching batchId');
    assert(Boolean(syncRes.body.data.serverTimestamp), 'Response contains server reconciliation timestamp');
    assert(syncRes.body.data.acknowledgedIds.includes('session-offline-01'), 'Acknowledged IDs contains session ID');
    assert(syncRes.body.data.acknowledgedIds.includes('hw-event-offline-01'), 'Acknowledged IDs contains hardware event ID');
    assert(syncRes.body.data.acknowledgedIds.includes('issue-offline-01'), 'Acknowledged IDs contains issue ID');
    assert(syncRes.body.data.acknowledgedIds.includes('maint-offline-01'), 'Acknowledged IDs contains maintenance ID');
    assert(syncRes.body.data.acknowledgedIds.includes('audit-offline-01'), 'Acknowledged IDs contains audit log ID');
    assert(syncRes.body.data.conflicts.length === 0, 'No conflicts detected on fresh entity insertion');

    // ------------------------------------------------------------------------
    // SECTION 3: Idempotent Batch Synchronization
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Idempotency & Repeat Transmission ---');

    // Resending the exact same batch must not error or duplicate entities
    const repeatSyncRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sync/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      }
    }, sampleBatchPayload);

    assert(repeatSyncRes.status === 200 && repeatSyncRes.body.success, 'Repeated sync batch returns HTTP 200 (Idempotent)');
    assert(repeatSyncRes.body.data.acknowledgedIds.length === 5, 'All 5 items acknowledged again without duplication');
    assert(repeatSyncRes.body.data.conflicts.length === 0, 'Zero conflicts on identical state retransmission');

    // ------------------------------------------------------------------------
    // SECTION 4: Conflict Detection & Server State Reconciliation
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Conflict Detection & Server State Authority ---');

    // Conflict 1: Central server marked session COMPLETED, but a stale client batch reports it ACTIVE
    const staleSessionPayload = {
      clientId: 'CLIENT-PC01',
      batchId: 'batch-conflict-01',
      timestamp: new Date().toISOString(),
      sessions: [
        {
          id: 'session-offline-01', // Already COMPLETED on central server
          studentId: studentLogin.body.data.user.id,
          labCode: 'LAB-01',
          pcCode: 'PC-01',
          status: 'ACTIVE' // Stale conflicting status
        }
      ],
      hardwareEvents: [],
      issues: [],
      maintenance: [],
      auditLogs: []
    };

    const conflictSessionRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sync/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      }
    }, staleSessionPayload);

    assert(conflictSessionRes.status === 200, 'Conflicting batch accepted with HTTP 200');
    assert(conflictSessionRes.body.data.conflicts.length === 1, 'Conflict detected for finalized session');
    const sessionConflict = conflictSessionRes.body.data.conflicts[0];
    assert(sessionConflict.entityId === 'session-offline-01', 'Conflict entityId matches session-offline-01');
    assert(sessionConflict.entityType === 'SESSION', 'Conflict entityType is SESSION');
    assert(sessionConflict.serverState.status === 'COMPLETED', 'Server authoritative status COMPLETED returned in serverState');

    // Conflict 2: Central server marked issue RESOLVED, but client batch reports it OPEN
    // First, resolve the issue on the server
    await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/issues/issue-offline-01/status',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${assistantToken}`
      }
    }, { status: 'RESOLVED' });

    // Stale client batch reports issue as OPEN
    const staleIssuePayload = {
      clientId: 'CLIENT-PC01',
      batchId: 'batch-conflict-02',
      timestamp: new Date().toISOString(),
      sessions: [],
      hardwareEvents: [],
      issues: [
        {
          id: 'issue-offline-01',
          labCode: 'LAB-01',
          pcCode: 'PC-01',
          status: 'OPEN',
          issueType: 'Mouse Problem',
          description: 'Mouse scroll wheel skipping'
        }
      ],
      maintenance: [],
      auditLogs: []
    };

    const conflictIssueRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sync/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      }
    }, staleIssuePayload);

    assert(conflictIssueRes.body.data.conflicts.length === 1, 'Conflict detected for resolved issue');
    const issueConflict = conflictIssueRes.body.data.conflicts[0];
    assert(issueConflict.entityId === 'issue-offline-01', 'Conflict entityId matches issue-offline-01');
    assert(issueConflict.serverState.status === 'RESOLVED', 'Server authoritative state is RESOLVED');

    // ------------------------------------------------------------------------
    // SECTION 5: Desktop SyncEngine Background Processor
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Desktop SyncEngine Client Engine ---');

    const { SyncEngine } = require('./syncEngine.cjs');
    const { LocalDbService } = require('./localDb.cjs');

    SyncEngine.setClientId('CLIENT-TEST-01');

    // 1. Enqueue an offline session and hardware event into SQLite sync_queue
    await LocalDbService.clearLocalStore();
    const localSess = await LocalDbService.startLocalSession({
      studentId: studentLogin.body.data.user.id,
      studentName: 'Local Student',
      labCode: 'LAB-01',
      pcCode: 'PC-03'
    });
    const localHw = await LocalDbService.recordLocalHardwareEvent({
      labCode: 'LAB-01',
      pcCode: 'PC-03',
      eventType: 'HARDWARE_CONNECTED',
      description: 'Headset attached'
    });

    const pendingBefore = await LocalDbService.getPendingSyncItems();
    assert(pendingBefore.length >= 2, `Local sync_queue has pending items (Found ${pendingBefore.length})`);

    // 2. State inspection
    const initialState = await SyncEngine.getState();
    assert(initialState.isSyncing === false, 'SyncEngine isSyncing is initially false');
    assert(initialState.pendingCount >= 2, 'SyncEngine reports accurate pendingCount');

    // 3. Process conflict recording & resolution in LocalDbService
    const recordedConflict = await LocalDbService.recordSyncConflict({
      batchId: 'batch-conflict-03',
      entityType: 'SESSION',
      entityId: localSess.id,
      reason: 'Server state mismatch test',
      serverPayload: { status: 'COMPLETED' }
    });
    assert(Boolean(recordedConflict.id), 'Sync conflict recorded in local SQLite sync_conflicts');
    assert(recordedConflict.status === 'UNRESOLVED', 'Recorded conflict status is UNRESOLVED');

    const allConflicts = await LocalDbService.getSyncConflicts();
    assert(allConflicts.length >= 1, 'getSyncConflicts returns recorded conflicts');

    await LocalDbService.resolveSyncConflict(recordedConflict.id, 'RESOLVED');
    assert(recordedConflict.status === 'RESOLVED', 'Sync conflict resolved to RESOLVED');

    // 4. Subscription test
    let subscriberState = null;
    const unsub = SyncEngine.subscribe((st) => {
      subscriberState = st;
    });
    await new Promise((r) => setTimeout(r, 20));
    assert(Boolean(subscriberState), 'SyncEngine state subscriber receives telemetry updates');
    assert(subscriberState.consecutiveFailures === 0, 'Consecutive failures is initially 0');
    unsub();

    // 5. Attempt increment tracking
    const testItems = await LocalDbService.getPendingSyncItems();
    const firstQueueItem = testItems[0];
    const initialAttempts = firstQueueItem.attempt_count;
    await LocalDbService.incrementSyncItemAttempt(firstQueueItem.id);
    assert(firstQueueItem.attempt_count === initialAttempts + 1, 'incrementSyncItemAttempt increments attempt count on queue item');

    // 6. Marking sync items processed
    await LocalDbService.markSyncItemProcessed(firstQueueItem.id, 'batch-completed-01');
    assert(firstQueueItem.status === 'SYNCED', 'markSyncItemProcessed marks queue item as SYNCED');

    // ------------------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------------------
    console.log('\n============================================================');
    console.log(`PHASE 20 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Unhandled error during test run:', err);
  process.exit(1);
});
