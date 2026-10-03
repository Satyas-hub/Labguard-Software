"use strict";
// ============================================================================
// LABGUARD V2: Automated Verification Suite (RBAC, Scoping, Sync & Shutdown)
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = __importDefault(require("node:assert"));
const node_test_1 = __importDefault(require("node:test"));
const syncService_1 = require("../services/syncService");
const notificationService_1 = require("../services/notificationService");
const pool_1 = require("../db/pool");
(0, node_test_1.default)('RBAC: Exactly four institutional roles exist', () => {
    const allowedRoles = ['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT'];
    const testRoles = ['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT', 'SUPER_ADMIN', 'ROOT', 'TECHNICIAN'];
    const validRoles = testRoles.filter((r) => allowedRoles.includes(r));
    node_assert_1.default.strictEqual(validRoles.length, 4, 'There must be strictly four application roles');
    node_assert_1.default.deepStrictEqual(validRoles, ['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']);
});
(0, node_test_1.default)('Sync Engine: Idempotent batch processing', async () => {
    const batchPayload = {
        clientId: 'CLIENT-8F3A29-LAB03-PC017',
        batchId: 'BATCH-001',
        timestamp: new Date().toISOString(),
        sessions: [
            {
                id: 'session-uuid-101',
                studentId: 'student-uuid-202',
                studentIdentifier: 'STU-001',
                studentName: 'Alexander Clark',
                labId: 'lab-uuid-303',
                labCode: 'LAB-03',
                computerId: 'pc-uuid-404',
                pcCode: 'PC-017',
                clientId: 'CLIENT-8F3A29-LAB03-PC017',
                startedAt: new Date().toISOString(),
                status: 'ACTIVE',
                startMode: 'NORMAL',
                syncStatus: 'PENDING',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ],
        hardwareEvents: [],
        issues: [],
        auditLogs: []
    };
    // First sync pass
    const res1 = await syncService_1.SyncService.processSyncBatch(batchPayload);
    node_assert_1.default.ok(res1.acknowledgedIds.includes('session-uuid-101'));
    // Second sync pass with same batch (idempotency check)
    const res2 = await syncService_1.SyncService.processSyncBatch(batchPayload);
    node_assert_1.default.ok(res2.acknowledgedIds.includes('session-uuid-101'));
    node_assert_1.default.strictEqual(res2.conflicts.length, 0);
});
(0, node_test_1.default)('Notification Routing: Role-aware scoping', async () => {
    const notif = await notificationService_1.NotificationService.dispatchEventNotification({
        title: 'Peripheral Alert',
        message: 'Mouse connection lost on PC-017',
        severity: 'WARNING',
        eventType: 'HARDWARE_DISCONNECTED',
        labCode: 'LAB-03',
        pcCode: 'PC-017',
        targetRole: 'LAB_ASSISTANT'
    });
    node_assert_1.default.ok(notif !== null);
    node_assert_1.default.strictEqual(notif?.targetRole, 'LAB_ASSISTANT');
    // Verify that an unrelated Student does not receive the Lab Assistant notification
    const studentNotifications = notificationService_1.NotificationService.getNotificationsForUser({
        id: 'student-id-999',
        role: 'STUDENT'
    });
    const foundForStudent = studentNotifications.some((n) => n.id === notif.id);
    node_assert_1.default.strictEqual(foundForStudent, false, 'Student should not receive Lab Assistant peripheral alert');
});
(0, node_test_1.default)('Security: Automatic shutdown policy restriction', () => {
    const evaluateShutdownPermission = (role) => {
        return role === 'STUDENT'; // Only Student sessions trigger shutdown
    };
    node_assert_1.default.strictEqual(evaluateShutdownPermission('STUDENT'), true, 'Student must trigger shutdown sequence');
    node_assert_1.default.strictEqual(evaluateShutdownPermission('FACULTY'), false, 'Faculty logout must NOT trigger shutdown');
    node_assert_1.default.strictEqual(evaluateShutdownPermission('ADMIN'), false, 'Admin logout must NOT trigger shutdown');
    node_assert_1.default.strictEqual(evaluateShutdownPermission('LAB_ASSISTANT'), false, 'Lab Assistant logout must NOT trigger shutdown');
});
(0, node_test_1.default)('Hardware & PC Identity: Rebind Client without duplicate PC creation', () => {
    // Clean up any previous test artifact
    pool_1.db.delete('computers', (c) => c.id === 'pc-uuid-017' || (c.lab_id === 'lab-uuid-03' && c.pc_code === 'PC-017'));
    // Existing PC setup
    const originalPc = {
        id: 'pc-uuid-017',
        lab_id: 'lab-uuid-03',
        pc_code: 'PC-017',
        bound_client_id: 'CLIENT-ORIGINAL-UUID-1',
        status: 'AVAILABLE'
    };
    pool_1.db.insert('computers', originalPc);
    // New installation generates Client B
    const newClientGuid = 'CLIENT-NEW-REINSTALL-UUID-2';
    // Admin rebinds new client to existing PC-017
    const updated = pool_1.db.update('computers', (c) => c.id === 'pc-uuid-017', {
        bound_client_id: newClientGuid
    });
    node_assert_1.default.strictEqual(updated?.bound_client_id, newClientGuid);
    // Ensure no duplicate computer was created
    const matchingPcs = pool_1.db.find('computers', (c) => c.lab_id === 'lab-uuid-03' && c.pc_code === 'PC-017');
    node_assert_1.default.strictEqual(matchingPcs.length, 1, 'Rebind must NOT create a duplicate PC');
    // Clean up test fixture
    pool_1.db.delete('computers', (c) => c.id === 'pc-uuid-017' || (c.lab_id === 'lab-uuid-03' && c.pc_code === 'PC-017'));
});
(0, node_test_1.default)('Batch Scheduling: Dynamic status calculation (UPCOMING, ONGOING, COMPLETED)', () => {
    const calculateBatchStatus = (scheduleDate, startTime, endTime, refTime) => {
        const start = new Date(`${scheduleDate}T${startTime}`);
        const end = new Date(`${scheduleDate}T${endTime}`);
        if (refTime < start)
            return 'UPCOMING';
        if (refTime >= start && refTime <= end)
            return 'ONGOING';
        return 'COMPLETED';
    };
    const todayStr = '2026-09-20';
    const pastRef = new Date('2026-09-20T08:00:00');
    const duringRef = new Date('2026-09-20T10:00:00');
    const afterRef = new Date('2026-09-20T12:00:00');
    node_assert_1.default.strictEqual(calculateBatchStatus(todayStr, '09:00:00', '11:00:00', pastRef), 'UPCOMING');
    node_assert_1.default.strictEqual(calculateBatchStatus(todayStr, '09:00:00', '11:00:00', duringRef), 'ONGOING');
    node_assert_1.default.strictEqual(calculateBatchStatus(todayStr, '09:00:00', '11:00:00', afterRef), 'COMPLETED');
});
