// ============================================================================
// LABGUARD V2: Desktop Synchronization Engine (Phase 20)
// Manages background queue draining, network polling, exponential backoff,
// batch transmission to POST /api/sync/batch, and conflict reconciliation.
// ============================================================================

import { ApiClient } from './api';
import { LocalDbService, LocalSyncQueueItem, LocalSyncConflict } from '../db/localDb';
import { SyncBatchPayload, SyncBatchResponse, Session, HardwareEvent, Issue, AuditLog, MaintenanceRecord } from '../../../shared/types';

export interface SyncEngineState {
  isSyncing: boolean;
  lastSyncTimestamp: string | null;
  pendingCount: number;
  conflictCount: number;
  consecutiveFailures: number;
  currentDelayMs: number;
  lastError: string | null;
}

export type SyncStateListener = (state: SyncEngineState) => void;

class SyncEngineService {
  private timer: any = null;
  private isRunning: boolean = false;
  private isSyncing: boolean = false;
  private lastSyncTimestamp: string | null = null;
  private consecutiveFailures: number = 0;
  private lastError: string | null = null;
  private listeners: Set<SyncStateListener> = new Set();

  // Backoff Configuration
  private readonly defaultIntervalMs: number = 15000; // 15s standard poll
  private readonly baseBackoffMs: number = 2000;      // 2s initial retry
  private readonly maxBackoffMs: number = 60000;      // 60s max ceiling
  private currentDelayMs: number = 15000;
  private clientId: string = 'CLIENT-LOCAL';

  constructor() {
    // Listen for online events to trigger immediate synchronization
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncEngine] Network connectivity detected. Initiating immediate sync cycle.');
        this.syncNow().catch(console.warn);
      });
    }
  }

  public setClientId(clientId: string) {
    this.clientId = clientId;
  }

  /**
   * Starts automatic background synchronization polling
   */
  public start(intervalMs?: number) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentDelayMs = intervalMs || this.defaultIntervalMs;
    console.log(`[SyncEngine] Started automatic sync polling (Interval: ${this.currentDelayMs}ms)`);
    this.scheduleNext(1000); // Trigger initial synchronization quickly
  }

  /**
   * Stops background polling
   */
  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[SyncEngine] Stopped background sync polling.');
  }

  private scheduleNext(delayMs: number) {
    if (!this.isRunning) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      await this.processQueue();
      if (this.isRunning) {
        this.scheduleNext(this.currentDelayMs);
      }
    }, delayMs);
  }

  /**
   * Manually triggers an immediate synchronization cycle
   */
  public async syncNow(): Promise<SyncBatchResponse | null> {
    return await this.processQueue();
  }

  /**
   * Executes a single queue draining and synchronization cycle
   */
  public async processQueue(): Promise<SyncBatchResponse | null> {
    if (this.isSyncing) return null;

    this.isSyncing = true;
    this.notifyState();

    try {
      const pendingItems = await LocalDbService.getPendingSyncItems();
      if (!pendingItems || pendingItems.length === 0) {
        this.isSyncing = false;
        this.consecutiveFailures = 0;
        this.currentDelayMs = this.defaultIntervalMs;
        this.lastError = null;
        this.notifyState();
        return null;
      }

      // Group queued items into typed collections for central API
      const sessions: Session[] = [];
      const hardwareEvents: HardwareEvent[] = [];
      const issues: Issue[] = [];
      const maintenance: MaintenanceRecord[] = [];
      const auditLogs: AuditLog[] = [];
      const batchItemIds: string[] = [];

      for (const item of pendingItems) {
        batchItemIds.push(item.id);
        try {
          const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
          switch (item.entity_type) {
            case 'SESSION':
              sessions.push(payload);
              break;
            case 'HARDWARE_EVENT':
              hardwareEvents.push(payload);
              break;
            case 'ISSUE':
              issues.push(payload);
              break;
            case 'MAINTENANCE':
              maintenance.push(payload);
              break;
            case 'AUDIT_LOG':
              auditLogs.push(payload);
              break;
            default:
              break;
          }
        } catch (err: any) {
          console.warn(`[SyncEngine] Failed to parse payload for sync item ${item.id}:`, err);
        }
      }

      const batchId = 'batch-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
      const syncPayload: SyncBatchPayload = {
        clientId: this.clientId,
        batchId,
        timestamp: new Date().toISOString(),
        sessions,
        hardwareEvents,
        issues,
        maintenance,
        auditLogs
      };

      // Transmit batch to backend API
      const res = await ApiClient.request<SyncBatchResponse>('/sync/batch', {
        method: 'POST',
        body: JSON.stringify(syncPayload)
      });

      if (res.success && res.data) {
        const syncResponse = res.data;

        // 1. Mark acknowledged items as SYNCED in local SQLite
        if (syncResponse.acknowledgedIds && Array.isArray(syncResponse.acknowledgedIds)) {
          for (const entityId of syncResponse.acknowledgedIds) {
            // Find corresponding queue items
            const matchingQueueItems = pendingItems.filter(
              (item) => item.entity_id === entityId || item.id === entityId
            );
            for (const qi of matchingQueueItems) {
              await LocalDbService.markSyncItemProcessed(qi.id, batchId);
            }
          }
        }

        // 2. Process and record server conflicts
        if (syncResponse.conflicts && syncResponse.conflicts.length > 0) {
          for (const conflict of syncResponse.conflicts) {
            await LocalDbService.recordSyncConflict({
              batchId,
              entityType: conflict.entityType,
              entityId: conflict.entityId,
              reason: conflict.reason,
              serverPayload: conflict.serverState
            });

            // Reconcile local state to server authoritative state
            if (conflict.entityType === 'SESSION' && conflict.serverState) {
              const sState = conflict.serverState as any;
              await LocalDbService.execute(
                `UPDATE local_sessions SET status = '${sState.status}', ended_at = '${sState.endedAt || ''}', sync_status = 'SYNCED' WHERE id = '${conflict.entityId}';`
              );
            } else if (conflict.entityType === 'ISSUE' && conflict.serverState) {
              const iState = conflict.serverState as any;
              await LocalDbService.execute(
                `UPDATE local_issues SET status = '${iState.status}', sync_status = 'SYNCED' WHERE id = '${conflict.entityId}';`
              );
            }
          }
        }

        // 3. Reset exponential backoff on successful transmission
        this.consecutiveFailures = 0;
        this.currentDelayMs = this.defaultIntervalMs;
        this.lastSyncTimestamp = syncResponse.serverTimestamp || new Date().toISOString();
        this.lastError = null;
        this.isSyncing = false;
        this.notifyState();

        return syncResponse;
      } else {
        // Handle sync transmission failure with exponential backoff
        throw new Error(res.message || res.error || 'Server rejected batch synchronization');
      }
    } catch (err: any) {
      this.consecutiveFailures += 1;
      this.lastError = err.message || 'Sync transmission failed';

      // Calculate exponential backoff with random jitter
      const exponential = this.baseBackoffMs * Math.pow(2, Math.min(this.consecutiveFailures, 6));
      const jitter = Math.floor(Math.random() * 1000);
      this.currentDelayMs = Math.min(this.maxBackoffMs, exponential + jitter);

      // Increment attempt counts on queued items
      try {
        const pending = await LocalDbService.getPendingSyncItems();
        for (const item of pending) {
          await LocalDbService.incrementSyncItemAttempt(item.id);
        }
      } catch {
        // ignore fallback errors
      }

      console.warn(
        `[SyncEngine] Batch sync failed (Failure #${this.consecutiveFailures}). Retrying in ${this.currentDelayMs}ms. Reason: ${this.lastError}`
      );
      this.isSyncing = false;
      this.notifyState();
      return null;
    }
  }

  /**
   * Retrieves active conflicts from local SQLite
   */
  public async getConflicts(): Promise<LocalSyncConflict[]> {
    return await LocalDbService.getSyncConflicts();
  }

  /**
   * Resolves a recorded synchronization conflict
   */
  public async resolveConflict(conflictId: string, resolutionStatus: string = 'RESOLVED'): Promise<void> {
    await LocalDbService.resolveSyncConflict(conflictId, resolutionStatus);
    this.notifyState();
  }

  /**
   * Get observable telemetry state
   */
  public async getState(): Promise<SyncEngineState> {
    let pendingCount = 0;
    let conflictCount = 0;
    try {
      const pending = await LocalDbService.getPendingSyncItems();
      pendingCount = pending.length;
      const conflicts = await LocalDbService.getSyncConflicts();
      conflictCount = conflicts.filter((c) => c.status === 'UNRESOLVED').length;
    } catch {
      // ignore
    }

    return {
      isSyncing: this.isSyncing,
      lastSyncTimestamp: this.lastSyncTimestamp,
      pendingCount,
      conflictCount,
      consecutiveFailures: this.consecutiveFailures,
      currentDelayMs: this.currentDelayMs,
      lastError: this.lastError
    };
  }

  /**
   * Subscribe to sync engine state updates
   */
  public subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    this.getState().then((st) => listener(st));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notifyState() {
    const state = await this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[SyncEngine] Error in state listener:', e);
      }
    }
  }
}

export const SyncEngine = new SyncEngineService();
