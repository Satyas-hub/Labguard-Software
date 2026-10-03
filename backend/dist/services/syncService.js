"use strict";
// ============================================================================
// LABGUARD V2: Idempotent Synchronization & Conflict Resolution Engine
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const notificationService_1 = require("./notificationService");
class SyncService {
    /**
     * Process a batch of offline changes submitted by a registered desktop client
     */
    static async processSyncBatch(payload) {
        const acknowledgedIds = [];
        const conflicts = [];
        const serverTimestamp = new Date().toISOString();
        // 1. Process Sessions
        if (payload.sessions && Array.isArray(payload.sessions)) {
            for (const session of payload.sessions) {
                try {
                    const existing = pool_1.db.findOne('sessions', (s) => s.id === session.id);
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
                        pool_1.db.update('sessions', (s) => s.id === session.id, {
                            status: session.status,
                            endedAt: session.endedAt,
                            endMode: session.endMode,
                            updatedAt: serverTimestamp,
                            syncStatus: 'SYNCED'
                        });
                    }
                    else {
                        // Insert new session from offline client
                        pool_1.db.insert('sessions', {
                            ...session,
                            syncStatus: 'SYNCED',
                            updatedAt: serverTimestamp
                        });
                    }
                    acknowledgedIds.push(session.id);
                }
                catch (e) {
                    console.error(`[Sync Engine] Error processing session ${session.id}:`, e.message);
                }
            }
        }
        // 2. Process Hardware Events
        if (payload.hardwareEvents && Array.isArray(payload.hardwareEvents)) {
            for (const event of payload.hardwareEvents) {
                const existing = pool_1.db.findOne('hardware_events', (h) => h.id === event.id);
                if (!existing) {
                    pool_1.db.insert('hardware_events', {
                        ...event,
                        syncStatus: 'SYNCED'
                    });
                    // Dispatch notification if peripheral was disconnected
                    if (event.eventType === 'HARDWARE_DISCONNECTED' || event.eventType === 'DEVICE_MISSING') {
                        await notificationService_1.NotificationService.dispatchEventNotification({
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
                const existing = pool_1.db.findOne('issues', (i) => i.id === issue.id);
                if (!existing) {
                    pool_1.db.insert('issues', {
                        ...issue,
                        updatedAt: serverTimestamp
                    });
                    await notificationService_1.NotificationService.dispatchEventNotification({
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
        // 4. Process Audit Logs
        if (payload.auditLogs && Array.isArray(payload.auditLogs)) {
            for (const log of payload.auditLogs) {
                const existing = pool_1.db.findOne('audit_logs', (a) => a.id === log.id);
                if (!existing) {
                    pool_1.db.insert('audit_logs', log);
                }
                acknowledgedIds.push(log.id);
            }
        }
        // Record sync event
        pool_1.db.insert('sync_events', {
            id: (0, uuid_1.v4)(),
            clientId: payload.clientId,
            batchId: payload.batchId,
            itemsCount: acknowledgedIds.length,
            conflictsCount: conflicts.length,
            timestamp: serverTimestamp
        });
        return {
            batchId: payload.batchId,
            serverTimestamp,
            acknowledgedIds,
            conflicts
        };
    }
}
exports.SyncService = SyncService;
