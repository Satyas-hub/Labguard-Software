// ============================================================================
// LABGUARD V2: Idempotent Synchronization & Conflict Resolution Engine
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import { SyncBatchPayload, SyncBatchResponse, Session, HardwareEvent, Issue, AuditLog } from '../../../shared/types';
import { db } from '../db/pool';
import { NotificationService } from './notificationService';
import { SupabaseSyncService } from './supabaseSyncService';

export class SyncService {
  /**
   * Process a batch of offline changes submitted by a registered desktop client
   */
  public static async processSyncBatch(payload: SyncBatchPayload): Promise<SyncBatchResponse> {
    const acknowledgedIds: string[] = [];
    const conflicts: SyncBatchResponse['conflicts'] = [];
    const serverTimestamp = new Date().toISOString();

    // 1. Process Sessions
    if (payload.sessions && Array.isArray(payload.sessions)) {
      for (const session of payload.sessions) {
        try {
          const existing = db.findOne<Session>('sessions', (s) => s.id === session.id);
          if (existing) {
            // Check for conflict (e.g. server session is already marked COMPLETED by admin)
            if (existing.status === 'COMPLETED' && session.status === 'ACTIVE') {
              conflicts.push({
                entityId: session.id,
                entityType: 'SESSION',
                reason: 'Session already finalized on central server',
                serverState: existing
              });
              acknowledgedIds.push(session.id);
              continue;
            }

            // Update session
            db.update<Session>('sessions', (s) => s.id === session.id, {
              status: session.status,
              endedAt: session.endedAt,
              endMode: session.endMode,
              updatedAt: serverTimestamp,
              syncStatus: 'SYNCED'
            });
          } else {
            // Insert new session from offline client
            db.insert('sessions', {
              ...session,
              syncStatus: 'SYNCED',
              updatedAt: serverTimestamp
            });
          }
          acknowledgedIds.push(session.id);
        } catch (e: any) {
          console.error(`[Sync Engine] Error processing session ${session.id}:`, e.message);
        }
      }
    }

    // 2. Process Hardware Events
    if (payload.hardwareEvents && Array.isArray(payload.hardwareEvents)) {
      for (const event of payload.hardwareEvents) {
        const existing = db.findOne<HardwareEvent>('hardware_events', (h) => h.id === event.id);
        if (!existing) {
          db.insert('hardware_events', {
            ...event,
            syncStatus: 'SYNCED'
          });

          // Dispatch notification if peripheral was disconnected
          if (event.eventType === 'HARDWARE_DISCONNECTED' || event.eventType === 'DEVICE_MISSING') {
            await NotificationService.dispatchEventNotification({
              title: `Peripheral Alert: ${event.labCode} / ${event.pcCode}`,
              message: event.description,
              severity: 'WARNING',
              eventType: event.eventType,
              labCode: event.labCode,
              pcCode: event.pcCode,
              targetRole: 'LAB_ASSISTANT'
            });
          }
        }
        acknowledgedIds.push(event.id);
      }
    }

    // 3. Process Issues
    if (payload.issues && Array.isArray(payload.issues)) {
      for (const issue of payload.issues) {
        const existing = db.findOne<Issue>('issues', (i) => i.id === issue.id);
        if (existing) {
          // Conflict check: Central server already resolved the issue
          if (existing.status === 'RESOLVED' && issue.status === 'OPEN') {
            conflicts.push({
              entityId: issue.id,
              entityType: 'ISSUE',
              reason: 'Issue was already marked RESOLVED by facility technician',
              serverState: existing
            });
            acknowledgedIds.push(issue.id);
            continue;
          }

          db.update<Issue>('issues', (i) => i.id === issue.id, {
            status: issue.status,
            description: issue.description,
            updatedAt: serverTimestamp
          });
        } else {
          db.insert('issues', {
            ...issue,
            labId: (issue as any).labId || issue.labCode,
            updatedAt: serverTimestamp
          });

          await NotificationService.dispatchEventNotification({
            title: `New Issue Reported: ${issue.labCode} / ${issue.pcCode}`,
            message: `${issue.issueType}: ${issue.description}`,
            severity: 'INFO',
            eventType: 'NEW_ISSUE',
            labCode: issue.labCode,
            pcCode: issue.pcCode,
            targetRole: 'LAB_ASSISTANT'
          });
        }
        acknowledgedIds.push(issue.id);
      }
    }

    // 4. Process Maintenance Orders
    if (payload.maintenance && Array.isArray(payload.maintenance)) {
      for (const order of payload.maintenance) {
        const existing = db.findOne<any>('maintenance', (m) => m.id === order.id);
        if (existing) {
          db.update<any>('maintenance', (m) => m.id === order.id, {
            status: order.status,
            actionTaken: order.actionTaken,
            endTime: order.endTime,
            cost: order.cost,
            updatedAt: serverTimestamp
          });
        } else {
          db.insert('maintenance', {
            ...order,
            updatedAt: serverTimestamp
          });
        }
        acknowledgedIds.push(order.id);
      }
    }

    // 5. Process Audit Logs
    if (payload.auditLogs && Array.isArray(payload.auditLogs)) {
      for (const log of payload.auditLogs) {
        const existing = db.findOne<AuditLog>('audit_logs', (a) => a.id === log.id);
        if (!existing) {
          db.insert('audit_logs', log);
        }
        acknowledgedIds.push(log.id);
      }
    }

    // Record sync event
    db.insert('sync_events', {
      id: uuidv4(),
      clientId: payload.clientId,
      batchId: payload.batchId,
      itemsCount: acknowledgedIds.length,
      conflictsCount: conflicts.length,
      timestamp: serverTimestamp
    });

    // Automatically synchronize all reports, sessions, issues and logs into Supabase
    SupabaseSyncService.syncBatch(payload).catch((err) => {
      console.warn('[SyncService] Supabase background synchronization error:', err.message || err);
    });

    return {
      batchId: payload.batchId,
      serverTimestamp,
      acknowledgedIds,
      conflicts
    };
  }
}
