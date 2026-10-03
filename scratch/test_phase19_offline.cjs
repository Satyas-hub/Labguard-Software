// ============================================================================
// LABGUARD V2 — PHASE 19: OFFLINE-FIRST ARCHITECTURE TEST SUITE
// Tests 14-table local SQLite persistence, cryptographic password verification,
// offline token validation, anti-privilege escalation guards, catalog caching,
// and sync_queue staging across all offline operations.
// ============================================================================

const http = require('http');
const jwt = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/node_modules/jsonwebtoken');

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
  console.log('LABGUARD V2 — PHASE 19: OFFLINE-FIRST ARCHITECTURE TEST SUITE');
  console.log('============================================================\n');

  // Start backend in-process by loading compiled server
  const { server } = require('c:/Users/Sakshit Sai/Desktop/Labguard/backend/dist/backend/src/server.js');
  await new Promise((resolve) => {
    server.listen(PORT, resolve);
  });
  console.log(`Backend test server listening on port ${PORT}.\n`);

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Online Authentication & Offline Token Retrieval
    // ------------------------------------------------------------------------
    console.log('--- SECTION 1: Online Authentication & Offline Token Delivery ---');
    
    // Login as Admin
    const adminLogin = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identifier: 'admin@labguard.edu', password: 'Admin@123456', role: 'ADMIN' });
    assert(adminLogin.status === 200 && adminLogin.body.success, 'Admin online login returns HTTP 200');
    assert(Boolean(adminLogin.body.data.offlineToken), 'Admin online login returns signed offlineToken');

    // Login as Student
    const studentLogin = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identifier: 'student@labguard.edu', password: 'Student@123456', role: 'STUDENT' });
    assert(studentLogin.status === 200 && studentLogin.body.success, 'Student online login returns HTTP 200');
    assert(Boolean(studentLogin.body.data.offlineToken), 'Student online login returns signed offlineToken');
    const studentUser = studentLogin.body.data.user;
    const studentOfflineToken = studentLogin.body.data.offlineToken;

    // Login as Assistant
    const assistantLogin = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identifier: 'assistant@labguard.edu', password: 'Assistant@123456', role: 'LAB_ASSISTANT' });
    assert(assistantLogin.status === 200 && assistantLogin.body.success, 'Assistant online login returns HTTP 200');
    const assistantUser = assistantLogin.body.data.user;
    const assistantOfflineToken = assistantLogin.body.data.offlineToken;

    // ------------------------------------------------------------------------
    // SECTION 2: Server-Side Offline Token Verification Endpoint
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 2: Server-Side Offline Token Verification Endpoint ---');

    // Valid offline token verification
    const verifyValid = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/verify-offline-token',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { offlineToken: studentOfflineToken });
    assert(verifyValid.status === 200 && verifyValid.body.success, 'Valid offline token verifies with HTTP 200');
    assert(verifyValid.body.data.payload.id === studentUser.id, 'Decoded offline token payload matches student user id');
    assert(verifyValid.body.data.payload.role === 'STUDENT', 'Decoded offline token payload preserves STUDENT role');

    // Missing token verification rejection
    const verifyMissing = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/verify-offline-token',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {});
    assert(verifyMissing.status === 400, 'Missing offline token rejected with HTTP 400 TOKEN_REQUIRED');

    // Tampered token verification rejection
    const verifyTampered = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/verify-offline-token',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { offlineToken: studentOfflineToken + 'tampered' });
    assert(verifyTampered.status === 401, 'Tampered offline token rejected with HTTP 401 INVALID_OFFLINE_TOKEN');

    // Expired offline token rejection
    const expiredToken = jwt.sign(
      { id: studentUser.id, role: 'STUDENT' },
      'LABGUARD_OFFLINE_DEV_SECRET_KEY_2026',
      { expiresIn: '-1s' }
    );
    const verifyExpired = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/verify-offline-token',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { offlineToken: expiredToken });
    assert(verifyExpired.status === 401, 'Expired offline token rejected with HTTP 401');

    // ------------------------------------------------------------------------
    // SECTION 3: Local SQLite Service Layer (LocalDbService)
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Local SQLite Service Layer (LocalDbService) ---');

    const { LocalDbService, hashOfflinePassword } = require('./localDb.cjs');

    // 1. Initialize local SQLite vaults
    const initMsg = await LocalDbService.init();
    assert(typeof initMsg === 'string', 'Local SQLite vaults initialized successfully');

    // Clear any previous state
    await LocalDbService.clearLocalStore();

    // 2. Cache offline student credentials
    await LocalDbService.cacheOfflineUser(
      {
        id: studentUser.id,
        email: studentUser.email,
        fullName: studentUser.fullName,
        role: 'STUDENT',
        identifier: 'STU-1001',
        assignedLabs: ['LAB-01']
      },
      'Password@123',
      studentOfflineToken
    );

    // 3. Cache offline assistant credentials
    await LocalDbService.cacheOfflineUser(
      {
        id: assistantUser.id,
        email: assistantUser.email,
        fullName: assistantUser.fullName,
        role: 'LAB_ASSISTANT',
        identifier: 'AST-2001',
        assignedLabs: ['LAB-01', 'LAB-02']
      },
      'Password@123',
      assistantOfflineToken
    );

    // Verify student is cached
    const cachedStudent = await LocalDbService.findLocalUser(studentUser.email);
    assert(Boolean(cachedStudent), 'Student record found in local SQLite vault');
    assert(cachedStudent.role === 'STUDENT', 'Cached student role is STUDENT');
    assert(Boolean(cachedStudent.password_hash), 'Cached student has salted password hash');

    // ------------------------------------------------------------------------
    // SECTION 4: Secure Offline Authentication & Privilege Escalation Guards
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: Secure Offline Auth & Anti-Privilege Escalation ---');

    // 1. Legitimate student offline login
    const validStudentAuth = await LocalDbService.verifyOfflineCredentials(
      'student@labguard.edu',
      'Password@123',
      'STUDENT'
    );
    assert(validStudentAuth.success === true, 'Student offline authentication succeeds with valid password');
    assert(validStudentAuth.user.role === 'STUDENT', 'Offline user role is STUDENT');
    assert(validStudentAuth.authorizedLabs.includes('LAB-01'), 'Student authorized labs include LAB-01');

    // 2. Student offline login by identifier (roll number)
    const validStudentByIdent = await LocalDbService.verifyOfflineCredentials(
      'STU-1001',
      'Password@123',
      'STUDENT'
    );
    assert(validStudentByIdent.success === true, 'Student offline authentication succeeds using identifier STU-1001');

    // 3. ANTI-PRIVILEGE ESCALATION: Student attempting to log in as ADMIN
    const studentEscalateAdmin = await LocalDbService.verifyOfflineCredentials(
      'student@labguard.edu',
      'Password@123',
      'ADMIN'
    );
    assert(studentEscalateAdmin.success === false, 'Student attempting offline login as ADMIN is blocked');
    assert(studentEscalateAdmin.error === 'PRIVILEGE_ESCALATION_BLOCKED', 'Error code is PRIVILEGE_ESCALATION_BLOCKED');

    // 4. ANTI-PRIVILEGE ESCALATION: Student attempting to log in as LAB_ASSISTANT
    const studentEscalateAssistant = await LocalDbService.verifyOfflineCredentials(
      'student@labguard.edu',
      'Password@123',
      'LAB_ASSISTANT'
    );
    assert(studentEscalateAssistant.success === false, 'Student attempting offline login as LAB_ASSISTANT is blocked');
    assert(studentEscalateAssistant.error === 'PRIVILEGE_ESCALATION_BLOCKED', 'Error code is PRIVILEGE_ESCALATION_BLOCKED');

    // 5. ANTI-PRIVILEGE ESCALATION: Student attempting to log in as FACULTY
    const studentEscalateFaculty = await LocalDbService.verifyOfflineCredentials(
      'student@labguard.edu',
      'Password@123',
      'FACULTY'
    );
    assert(studentEscalateFaculty.success === false, 'Student attempting offline login as FACULTY is blocked');
    assert(studentEscalateFaculty.error === 'PRIVILEGE_ESCALATION_BLOCKED', 'Error code is PRIVILEGE_ESCALATION_BLOCKED');

    // 6. ANTI-PRIVILEGE ESCALATION: Assistant attempting to log in as ADMIN
    const assistantEscalateAdmin = await LocalDbService.verifyOfflineCredentials(
      'assistant@labguard.edu',
      'Password@123',
      'ADMIN'
    );
    assert(assistantEscalateAdmin.success === false, 'Assistant attempting offline login as ADMIN is blocked');
    assert(assistantEscalateAdmin.error === 'PRIVILEGE_ESCALATION_BLOCKED', 'Error code is PRIVILEGE_ESCALATION_BLOCKED');

    // 7. Invalid password in offline mode
    const badPassAuth = await LocalDbService.verifyOfflineCredentials(
      'student@labguard.edu',
      'WrongPassword!999',
      'STUDENT'
    );
    assert(badPassAuth.success === false, 'Invalid offline password is rejected');
    assert(badPassAuth.error === 'INVALID_CREDENTIALS', 'Error code is INVALID_CREDENTIALS');

    // 8. Nonexistent / uncached user in offline mode
    const unknownUserAuth = await LocalDbService.verifyOfflineCredentials(
      'nonexistent@campus.edu',
      'Password@123',
      'STUDENT'
    );
    assert(unknownUserAuth.success === false, 'Uncached user offline login is rejected');
    assert(unknownUserAuth.error === 'USER_NOT_CACHED', 'Error code is USER_NOT_CACHED');

    // 9. Deactivated user in offline mode
    await LocalDbService.cacheOfflineUser(
      {
        id: 'user-deactivated-99',
        email: 'disabled@campus.edu',
        fullName: 'Disabled User',
        role: 'STUDENT'
      },
      'Password@123'
    );
    // Mark inactive in local SQLite
    await LocalDbService.execute("UPDATE local_users SET is_active = 0 WHERE email = 'disabled@campus.edu'");
    const disabledAuth = await LocalDbService.verifyOfflineCredentials(
      'disabled@campus.edu',
      'Password@123',
      'STUDENT'
    );
    assert(disabledAuth.success === false, 'Deactivated account offline login is rejected');
    assert(disabledAuth.error === 'ACCOUNT_DISABLED', 'Error code is ACCOUNT_DISABLED');

    // 10. Expired offline token rejection
    await LocalDbService.cacheOfflineUser(
      {
        id: 'user-expired-token-88',
        email: 'expired@campus.edu',
        fullName: 'Expired User',
        role: 'STUDENT'
      },
      'Password@123',
      expiredToken
    );
    const expiredAuth = await LocalDbService.verifyOfflineCredentials(
      'expired@campus.edu',
      'Password@123',
      'STUDENT'
    );
    assert(expiredAuth.success === false, 'User with expired offline token is rejected');
    assert(expiredAuth.error === 'OFFLINE_TOKEN_EXPIRED', 'Error code is OFFLINE_TOKEN_EXPIRED');

    // ------------------------------------------------------------------------
    // SECTION 5: Catalog Caching & Workstation Management
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: Catalog Caching & Workstation Management ---');

    const sampleLabs = [
      { id: 'lab-01', code: 'LAB-01', name: 'Advanced Systems Lab', room: 'Room 301', capacity: 30, status: 'ACTIVE', pcCount: 30, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    const sampleComputers = [
      { id: 'pc-01', labId: 'lab-01', labCode: 'LAB-01', pcCode: 'PC-01', state: 'AVAILABLE', isOnline: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'pc-02', labId: 'lab-01', labCode: 'LAB-01', pcCode: 'PC-02', state: 'AVAILABLE', isOnline: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    const sampleEquipment = [
      { id: 'eq-01', assetTag: 'EQ-KB-01', type: 'KEYBOARD', brand: 'Dell', model: 'KB216', serialNumber: 'SN-KB01', status: 'FUNCTIONAL', labCode: 'LAB-01', pcCode: 'PC-01' },
      { id: 'eq-02', assetTag: 'EQ-MS-01', type: 'MOUSE', brand: 'Dell', model: 'MS116', serialNumber: 'SN-MS01', status: 'FUNCTIONAL', labCode: 'LAB-01', pcCode: 'PC-01' }
    ];

    await LocalDbService.cacheCatalog(sampleLabs, sampleComputers, sampleEquipment);

    const localLabs = await LocalDbService.getLocalLabs();
    assert(localLabs.length >= 1, 'Local labs retrieved from SQLite catalog');
    assert(localLabs[0].code === 'LAB-01', 'First cached lab code is LAB-01');

    const localComps = await LocalDbService.getLocalComputers('LAB-01');
    assert(localComps.length === 2, 'Two workstations retrieved from local SQLite for LAB-01');

    const localEquip = await LocalDbService.getLocalEquipment('LAB-01', 'PC-01');
    assert(localEquip.length === 2, 'Two peripheral equipment items retrieved for PC-01');

    // ------------------------------------------------------------------------
    // SECTION 6: Offline Student Sessions Lifecycle
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Offline Student Sessions Lifecycle ---');

    // Start offline session
    const offlineSession = await LocalDbService.startLocalSession({
      studentId: studentUser.id,
      studentName: studentUser.fullName,
      studentIdentifier: 'STU-1001',
      labCode: 'LAB-01',
      pcCode: 'PC-01',
      clientId: 'CLIENT-PC01'
    });
    assert(Boolean(offlineSession.id), 'Offline session created with generated ID');
    assert(offlineSession.status === 'ACTIVE', 'Offline session status is ACTIVE');
    assert(offlineSession.sync_status === 'PENDING', 'Offline session marked PENDING for sync');

    // Verify PC-01 transitioned to IN_USE
    const activePc = await LocalDbService.getLocalComputers('LAB-01');
    const pc01 = activePc.find(p => p.pc_code === 'PC-01');
    assert(pc01.state === 'IN_USE', 'Workstation PC-01 transitioned to IN_USE in local SQLite');

    // Verify getActiveLocalSession finds it
    const activeFound = await LocalDbService.getActiveLocalSession(studentUser.id);
    assert(Boolean(activeFound) && activeFound.id === offlineSession.id, 'getActiveLocalSession successfully finds active session');

    // End offline session
    const endedSession = await LocalDbService.endLocalSession(offlineSession.id, 'MANUAL');
    assert(endedSession.status === 'COMPLETED', 'Offline session ended with status COMPLETED');
    assert(Boolean(endedSession.ended_at), 'Offline session has recorded ended_at timestamp');

    // Verify PC-01 restored to AVAILABLE
    const restoredComps = await LocalDbService.getLocalComputers('LAB-01');
    const pc01Restored = restoredComps.find(p => p.pc_code === 'PC-01');
    assert(pc01Restored.state === 'AVAILABLE', 'Workstation PC-01 restored to AVAILABLE in local SQLite');

    // ------------------------------------------------------------------------
    // SECTION 7: Offline Hardware Events, Issues & Maintenance
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 7: Offline Hardware Events, Issues & Maintenance ---');

    // Record offline hardware event
    const hwEvent = await LocalDbService.recordLocalHardwareEvent({
      labCode: 'LAB-01',
      pcCode: 'PC-01',
      eventType: 'HARDWARE_DISCONNECTED',
      description: 'Keyboard unseated during offline lab exercise',
      severity: 'WARNING'
    });
    assert(Boolean(hwEvent.id), 'Offline hardware event recorded with unique ID');
    assert(hwEvent.sync_status === 'PENDING', 'Offline hardware event marked PENDING for sync');

    const hwEvents = await LocalDbService.getLocalHardwareEvents('LAB-01');
    assert(hwEvents.length >= 1, 'Local hardware events query returns recorded event');

    // Create offline issue
    const localIssue = await LocalDbService.createLocalIssue({
      labCode: 'LAB-01',
      pcCode: 'PC-01',
      reportedBy: studentUser.id,
      issueType: 'Keyboard Problem',
      description: 'Keys sticking on offline terminal'
    });
    assert(Boolean(localIssue.id), 'Offline issue created with unique ID');
    assert(localIssue.status === 'OPEN', 'Offline issue status is OPEN');

    const issues = await LocalDbService.getLocalIssues(studentUser.id);
    assert(issues.length >= 1, 'Local issues query returns student reported issue');

    // Create offline maintenance work order
    const maintOrder = await LocalDbService.createLocalMaintenance({
      labCode: 'LAB-01',
      pcCode: 'PC-02',
      issueId: localIssue.id,
      responsibleUser: assistantUser.id,
      actionTaken: 'Cleaning key switches'
    });
    assert(Boolean(maintOrder.id), 'Offline maintenance order created with unique ID');
    assert(maintOrder.status === 'IN_PROGRESS', 'Offline maintenance status is IN_PROGRESS');

    // Check PC-02 transitioned to MAINTENANCE
    const compsMaint = await LocalDbService.getLocalComputers('LAB-01');
    const pc02Maint = compsMaint.find(p => p.pc_code === 'PC-02');
    assert(pc02Maint.state === 'MAINTENANCE', 'PC-02 transitioned to MAINTENANCE');

    // Update maintenance order to COMPLETED
    const updatedMaint = await LocalDbService.updateLocalMaintenance(maintOrder.id, {
      status: 'COMPLETED',
      actionTaken: 'Cleaning key switches & tested functional',
      endTime: new Date().toISOString()
    });
    assert(updatedMaint.status === 'COMPLETED', 'Offline maintenance updated to COMPLETED');

    // Check PC-02 restored to AVAILABLE
    const compsMaintDone = await LocalDbService.getLocalComputers('LAB-01');
    const pc02Done = compsMaintDone.find(p => p.pc_code === 'PC-02');
    assert(pc02Done.state === 'AVAILABLE', 'PC-02 restored to AVAILABLE after maintenance completed');

    // ------------------------------------------------------------------------
    // SECTION 8: Sync Queue Integrity (Phase 19 -> 20 Pipeline)
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 8: Sync Queue Integrity ---');

    const pendingSyncItems = await LocalDbService.getPendingSyncItems();
    assert(pendingSyncItems.length >= 5, `sync_queue has recorded all offline operations (Found ${pendingSyncItems.length} items)`);

    const hasSessionSync = pendingSyncItems.some(item => item.entity_type === 'SESSION');
    assert(hasSessionSync, 'sync_queue contains SESSION entries');

    const hasHwSync = pendingSyncItems.some(item => item.entity_type === 'HARDWARE_EVENT');
    assert(hasHwSync, 'sync_queue contains HARDWARE_EVENT entries');

    const hasIssueSync = pendingSyncItems.some(item => item.entity_type === 'ISSUE');
    assert(hasIssueSync, 'sync_queue contains ISSUE entries');

    const hasMaintSync = pendingSyncItems.some(item => item.entity_type === 'MAINTENANCE');
    assert(hasMaintSync, 'sync_queue contains MAINTENANCE entries');

    const hasAuditSync = pendingSyncItems.some(item => item.entity_type === 'AUDIT_LOG');
    assert(hasAuditSync, 'sync_queue contains AUDIT_LOG entries');

    // Mark an item processed
    const firstItem = pendingSyncItems[0];
    await LocalDbService.markSyncItemProcessed(firstItem.id, 'batch-test-01');
    assert(firstItem.status === 'SYNCED', 'Processed item marked SYNCED');

    // ------------------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------------------
    console.log('\n============================================================');
    console.log(`TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
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
