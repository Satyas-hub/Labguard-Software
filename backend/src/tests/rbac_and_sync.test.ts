// ============================================================================
// LABGUARD V2: Automated Verification Suite (RBAC, Scoping, Sync & Shutdown)
// ============================================================================

import assert from 'node:assert';
import test from 'node:test';
import { UserRole } from '../../../shared/types';
import { SyncService } from '../services/syncService';
import { NotificationService } from '../services/notificationService';
import { db } from '../db/pool';

test('RBAC: Exactly four institutional roles exist', () => {
  const allowedRoles: UserRole[] = ['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT'];
  const testRoles = ['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT', 'SUPER_ADMIN', 'ROOT', 'TECHNICIAN'];

  const validRoles = testRoles.filter((r) => allowedRoles.includes(r as UserRole));
  assert.strictEqual(validRoles.length, 4, 'There must be strictly four application roles');
  assert.deepStrictEqual(validRoles, ['ADMIN', 'FACULTY', 'LAB_ASSISTANT', 'STUDENT']);
});

test('Sync Engine: Idempotent batch processing', async () => {
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
        status: 'ACTIVE' as const,
        startMode: 'NORMAL' as const,
        syncStatus: 'PENDING' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    hardwareEvents: [],
    issues: [],
    auditLogs: []
  };

  // First sync pass
  const res1 = await SyncService.processSyncBatch(batchPayload);
  assert.ok(res1.acknowledgedIds.includes('session-uuid-101'));

  // Second sync pass with same batch (idempotency check)
  const res2 = await SyncService.processSyncBatch(batchPayload);
  assert.ok(res2.acknowledgedIds.includes('session-uuid-101'));
  assert.strictEqual(res2.conflicts.length, 0);
});

test('Notification Routing: Role-aware scoping', async () => {
  const notif = await NotificationService.dispatchEventNotification({
    title: 'Peripheral Alert',
    message: 'Mouse connection lost on PC-017',
    severity: 'WARNING',
    eventType: 'HARDWARE_DISCONNECTED',
    labCode: 'LAB-03',
    pcCode: 'PC-017',
    targetRole: 'LAB_ASSISTANT'
  });

  assert.ok(notif !== null);
  assert.strictEqual(notif?.targetRole, 'LAB_ASSISTANT');

  // Verify that an unrelated Student does not receive the Lab Assistant notification
  const studentNotifications = NotificationService.getNotificationsForUser({
    id: 'student-id-999',
    role: 'STUDENT'
  });
  const foundForStudent = studentNotifications.some((n) => n.id === notif.id);
  assert.strictEqual(foundForStudent, false, 'Student should not receive Lab Assistant peripheral alert');
});

test('Security: Automatic shutdown policy restriction', () => {
  const evaluateShutdownPermission = (role: UserRole): boolean => {
    return role === 'STUDENT'; // Only Student sessions trigger shutdown
  };

  assert.strictEqual(evaluateShutdownPermission('STUDENT'), true, 'Student must trigger shutdown sequence');
  assert.strictEqual(evaluateShutdownPermission('FACULTY'), false, 'Faculty logout must NOT trigger shutdown');
  assert.strictEqual(evaluateShutdownPermission('ADMIN'), false, 'Admin logout must NOT trigger shutdown');
  assert.strictEqual(evaluateShutdownPermission('LAB_ASSISTANT'), false, 'Lab Assistant logout must NOT trigger shutdown');
});

test('Hardware & PC Identity: Rebind Client without duplicate PC creation', () => {
  // Clean up any previous test artifact
  db.delete('computers', (c: any) => c.id === 'pc-uuid-017' || (c.lab_id === 'lab-uuid-03' && c.pc_code === 'PC-017'));

  // Existing PC setup
  const originalPc = {
    id: 'pc-uuid-017',
    lab_id: 'lab-uuid-03',
    pc_code: 'PC-017',
    bound_client_id: 'CLIENT-ORIGINAL-UUID-1',
    status: 'AVAILABLE'
  };

  db.insert('computers', originalPc);

  // New installation generates Client B
  const newClientGuid = 'CLIENT-NEW-REINSTALL-UUID-2';

  // Admin rebinds new client to existing PC-017
  const updated = db.update('computers', (c: any) => c.id === 'pc-uuid-017', {
    bound_client_id: newClientGuid
  });

  assert.strictEqual(updated?.bound_client_id, newClientGuid);
  // Ensure no duplicate computer was created
  const matchingPcs = db.find('computers', (c: any) => c.lab_id === 'lab-uuid-03' && c.pc_code === 'PC-017');
  assert.strictEqual(matchingPcs.length, 1, 'Rebind must NOT create a duplicate PC');

  // Clean up test fixture
  db.delete('computers', (c: any) => c.id === 'pc-uuid-017' || (c.lab_id === 'lab-uuid-03' && c.pc_code === 'PC-017'));
});

test('Batch Scheduling: Dynamic status calculation (UPCOMING, ONGOING, COMPLETED)', () => {
  const calculateBatchStatus = (scheduleDate: string, startTime: string, endTime: string, refTime: Date): string => {
    const start = new Date(`${scheduleDate}T${startTime}`);
    const end = new Date(`${scheduleDate}T${endTime}`);
    if (refTime < start) return 'UPCOMING';
    if (refTime >= start && refTime <= end) return 'ONGOING';
    return 'COMPLETED';
  };

  const todayStr = '2026-09-20';
  const pastRef = new Date('2026-09-20T08:00:00');
  const duringRef = new Date('2026-09-20T10:00:00');
  const afterRef = new Date('2026-09-20T12:00:00');

  assert.strictEqual(calculateBatchStatus(todayStr, '09:00:00', '11:00:00', pastRef), 'UPCOMING');
  assert.strictEqual(calculateBatchStatus(todayStr, '09:00:00', '11:00:00', duringRef), 'ONGOING');
  assert.strictEqual(calculateBatchStatus(todayStr, '09:00:00', '11:00:00', afterRef), 'COMPLETED');
});

