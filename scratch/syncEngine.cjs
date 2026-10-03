"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// desktop/src/services/syncEngine.ts
var syncEngine_exports = {};
__export(syncEngine_exports, {
  SyncEngine: () => SyncEngine
});
module.exports = __toCommonJS(syncEngine_exports);

// desktop/src/services/api.ts
var API_BASE_URL = "http://localhost:5000/api";
var ApiClient = class {
  static token = null;
  static refreshToken = null;
  static setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    if (accessToken) {
      sessionStorage.setItem("labguard_token", accessToken);
    } else {
      sessionStorage.removeItem("labguard_token");
    }
    if (refreshToken !== void 0) {
      this.refreshToken = refreshToken;
      if (refreshToken) {
        sessionStorage.setItem("labguard_refresh_token", refreshToken);
      } else {
        sessionStorage.removeItem("labguard_refresh_token");
      }
    }
  }
  static setToken(token) {
    this.setTokens(token);
  }
  static getToken() {
    if (!this.token) {
      this.token = sessionStorage.getItem("labguard_token");
    }
    return this.token;
  }
  static getRefreshToken() {
    if (!this.refreshToken) {
      this.refreshToken = sessionStorage.getItem("labguard_refresh_token");
    }
    return this.refreshToken;
  }
  static async refreshAccessToken() {
    const refresh = this.getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh })
      });
      const json = await res.json();
      if (res.ok && json.data?.accessToken) {
        this.setTokens(json.data.accessToken, json.data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  static async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      "Content-Type": "application/json",
      ...options.headers || {}
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    try {
      let res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });
      if (res.status === 401 && endpoint !== "/auth/login" && endpoint !== "/auth/refresh") {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          headers["Authorization"] = `Bearer ${this.getToken()}`;
          res = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
          });
        }
      }
      const json = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: json.error || `HTTP_${res.status}`,
          message: json.message || "Request failed"
        };
      }
      return json;
    } catch (err) {
      return {
        success: false,
        error: "NETWORK_ERROR",
        message: "Unable to communicate with central LABGUARD server (Operating Offline)"
      };
    }
  }
};

// desktop/src/services/syncEngine.ts
var import_localDb = require("./localDb.cjs");
var SyncEngineService = class {
  timer = null;
  isRunning = false;
  isSyncing = false;
  lastSyncTimestamp = null;
  consecutiveFailures = 0;
  lastError = null;
  listeners = /* @__PURE__ */ new Set();
  // Backoff Configuration
  defaultIntervalMs = 15e3;
  // 15s standard poll
  baseBackoffMs = 2e3;
  // 2s initial retry
  maxBackoffMs = 6e4;
  // 60s max ceiling
  currentDelayMs = 15e3;
  clientId = "CLIENT-LOCAL";
  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        console.log("[SyncEngine] Network connectivity detected. Initiating immediate sync cycle.");
        this.syncNow().catch(console.warn);
      });
    }
  }
  setClientId(clientId) {
    this.clientId = clientId;
  }
  /**
   * Starts automatic background synchronization polling
   */
  start(intervalMs) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentDelayMs = intervalMs || this.defaultIntervalMs;
    console.log(`[SyncEngine] Started automatic sync polling (Interval: ${this.currentDelayMs}ms)`);
    this.scheduleNext(1e3);
  }
  /**
   * Stops background polling
   */
  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log("[SyncEngine] Stopped background sync polling.");
  }
  scheduleNext(delayMs) {
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
  async syncNow() {
    return await this.processQueue();
  }
  /**
   * Executes a single queue draining and synchronization cycle
   */
  async processQueue() {
    if (this.isSyncing) return null;
    this.isSyncing = true;
    this.notifyState();
    try {
      const pendingItems = await import_localDb.LocalDbService.getPendingSyncItems();
      if (!pendingItems || pendingItems.length === 0) {
        this.isSyncing = false;
        this.consecutiveFailures = 0;
        this.currentDelayMs = this.defaultIntervalMs;
        this.lastError = null;
        this.notifyState();
        return null;
      }
      const sessions = [];
      const hardwareEvents = [];
      const issues = [];
      const maintenance = [];
      const auditLogs = [];
      const batchItemIds = [];
      for (const item of pendingItems) {
        batchItemIds.push(item.id);
        try {
          const payload = typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload;
          switch (item.entity_type) {
            case "SESSION":
              sessions.push(payload);
              break;
            case "HARDWARE_EVENT":
              hardwareEvents.push(payload);
              break;
            case "ISSUE":
              issues.push(payload);
              break;
            case "MAINTENANCE":
              maintenance.push(payload);
              break;
            case "AUDIT_LOG":
              auditLogs.push(payload);
              break;
            default:
              break;
          }
        } catch (err) {
          console.warn(`[SyncEngine] Failed to parse payload for sync item ${item.id}:`, err);
        }
      }
      const batchId = "batch-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now();
      const syncPayload = {
        clientId: this.clientId,
        batchId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessions,
        hardwareEvents,
        issues,
        maintenance,
        auditLogs
      };
      const res = await ApiClient.request("/sync/batch", {
        method: "POST",
        body: JSON.stringify(syncPayload)
      });
      if (res.success && res.data) {
        const syncResponse = res.data;
        if (syncResponse.acknowledgedIds && Array.isArray(syncResponse.acknowledgedIds)) {
          for (const entityId of syncResponse.acknowledgedIds) {
            const matchingQueueItems = pendingItems.filter(
              (item) => item.entity_id === entityId || item.id === entityId
            );
            for (const qi of matchingQueueItems) {
              await import_localDb.LocalDbService.markSyncItemProcessed(qi.id, batchId);
            }
          }
        }
        if (syncResponse.conflicts && syncResponse.conflicts.length > 0) {
          for (const conflict of syncResponse.conflicts) {
            await import_localDb.LocalDbService.recordSyncConflict({
              batchId,
              entityType: conflict.entityType,
              entityId: conflict.entityId,
              reason: conflict.reason,
              serverPayload: conflict.serverState
            });
            if (conflict.entityType === "SESSION" && conflict.serverState) {
              const sState = conflict.serverState;
              await import_localDb.LocalDbService.execute(
                `UPDATE local_sessions SET status = '${sState.status}', ended_at = '${sState.endedAt || ""}', sync_status = 'SYNCED' WHERE id = '${conflict.entityId}';`
              );
            } else if (conflict.entityType === "ISSUE" && conflict.serverState) {
              const iState = conflict.serverState;
              await import_localDb.LocalDbService.execute(
                `UPDATE local_issues SET status = '${iState.status}', sync_status = 'SYNCED' WHERE id = '${conflict.entityId}';`
              );
            }
          }
        }
        this.consecutiveFailures = 0;
        this.currentDelayMs = this.defaultIntervalMs;
        this.lastSyncTimestamp = syncResponse.serverTimestamp || (/* @__PURE__ */ new Date()).toISOString();
        this.lastError = null;
        this.isSyncing = false;
        this.notifyState();
        return syncResponse;
      } else {
        throw new Error(res.message || res.error || "Server rejected batch synchronization");
      }
    } catch (err) {
      this.consecutiveFailures += 1;
      this.lastError = err.message || "Sync transmission failed";
      const exponential = this.baseBackoffMs * Math.pow(2, Math.min(this.consecutiveFailures, 6));
      const jitter = Math.floor(Math.random() * 1e3);
      this.currentDelayMs = Math.min(this.maxBackoffMs, exponential + jitter);
      try {
        const pending = await import_localDb.LocalDbService.getPendingSyncItems();
        for (const item of pending) {
          await import_localDb.LocalDbService.incrementSyncItemAttempt(item.id);
        }
      } catch {
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
  async getConflicts() {
    return await import_localDb.LocalDbService.getSyncConflicts();
  }
  /**
   * Resolves a recorded synchronization conflict
   */
  async resolveConflict(conflictId, resolutionStatus = "RESOLVED") {
    await import_localDb.LocalDbService.resolveSyncConflict(conflictId, resolutionStatus);
    this.notifyState();
  }
  /**
   * Get observable telemetry state
   */
  async getState() {
    let pendingCount = 0;
    let conflictCount = 0;
    try {
      const pending = await import_localDb.LocalDbService.getPendingSyncItems();
      pendingCount = pending.length;
      const conflicts = await import_localDb.LocalDbService.getSyncConflicts();
      conflictCount = conflicts.filter((c) => c.status === "UNRESOLVED").length;
    } catch {
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
  subscribe(listener) {
    this.listeners.add(listener);
    this.getState().then((st) => listener(st));
    return () => {
      this.listeners.delete(listener);
    };
  }
  async notifyState() {
    const state = await this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error("[SyncEngine] Error in state listener:", e);
      }
    }
  }
};
var SyncEngine = new SyncEngineService();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SyncEngine
});
