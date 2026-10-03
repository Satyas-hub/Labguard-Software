"use strict";
// ============================================================================
// LABGUARD V2: Supabase Cloud Database Synchronization Bridge
// Synchronizes all local workstation reports, sessions, issues, maintenance,
// and hardware telemetry into Supabase PostgreSQL when online.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseSyncService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("../config/env");
class SupabaseSyncEngine {
    client = null;
    stats = {
        enabled: false,
        connected: false,
        lastSyncedAt: null,
        totalSyncedSessions: 0,
        totalSyncedIssues: 0,
        totalSyncedMaintenance: 0,
        totalSyncedEvents: 0,
        totalSyncedAuditLogs: 0,
        lastError: null
    };
    constructor() {
        this.init();
    }
    init() {
        if (env_1.ENV.SUPABASE_URL && env_1.ENV.SUPABASE_KEY) {
            try {
                this.client = (0, supabase_js_1.createClient)(env_1.ENV.SUPABASE_URL, env_1.ENV.SUPABASE_KEY, {
                    auth: { persistSession: false }
                });
                this.stats.enabled = true;
                this.stats.connected = true;
                console.log('[Supabase Sync] Initialized connection to Supabase instance:', env_1.ENV.SUPABASE_URL);
            }
            catch (e) {
                this.stats.lastError = e.message;
                console.warn('[Supabase Sync] Failed to initialize Supabase client:', e.message);
            }
        }
        else {
            this.stats.enabled = false;
            this.stats.connected = false;
            console.log('[Supabase Sync] Supabase credentials not detected in .env; operational in local/PostgreSQL mode.');
        }
    }
    getStats() {
        return { ...this.stats };
    }
    /**
     * Automatically synchronizes an entire sync batch into Supabase tables
     */
    async syncBatch(payload) {
        if (!this.client || !this.stats.enabled) {
            return { success: false, syncedCount: 0, error: 'Supabase credentials not configured in backend/.env' };
        }
        let syncedCount = 0;
        const now = new Date().toISOString();
        try {
            // 1. Sync Sessions (Lab Usage & Student Attendance Reports)
            if (payload.sessions && payload.sessions.length > 0) {
                const rows = payload.sessions.map((s) => ({
                    id: s.id,
                    user_id: s.studentId || null,
                    client_id: payload.clientId,
                    student_id: s.studentId,
                    student_identifier: s.studentIdentifier || null,
                    student_name: s.studentName || null,
                    roll_number: s.rollNumber || s.studentIdentifier || null,
                    computer_id: s.computerId,
                    lab_id: s.labId,
                    lab_code: s.labCode || null,
                    pc_code: s.pcCode || null,
                    start_time: s.startedAt,
                    started_at: s.startedAt,
                    end_time: s.endedAt || null,
                    ended_at: s.endedAt || null,
                    status: s.status,
                    start_mode: s.startMode || 'NORMAL',
                    end_mode: s.endMode || null,
                    duration_minutes: s.durationMinutes || null,
                    notes: s.notes || null,
                    sync_status: 'SYNCED',
                    synced_at: now
                }));
                const { error } = await this.client.from('sessions').upsert(rows, { onConflict: 'id' });
                if (error) {
                    console.warn('[Supabase Sync] Error syncing sessions:', error.message);
                }
                else {
                    this.stats.totalSyncedSessions += rows.length;
                    syncedCount += rows.length;
                }
            }
            // 2. Sync Issues (Defect & Lab Problem Reports)
            if (payload.issues && payload.issues.length > 0) {
                const rows = payload.issues.map((i) => ({
                    id: i.id,
                    issue_code: i.issueCode || ('ISS-' + (i.id.slice(0, 8)).toUpperCase()),
                    title: i.title || i.issueType || 'Lab Hardware/System Issue',
                    client_id: payload.clientId,
                    reported_by: i.reportedBy,
                    reported_by_user_id: i.reportedBy || null,
                    reporter_name: i.reporterName || null,
                    reporter_role: i.reporterRole || null,
                    computer_id: i.computerId || null,
                    equipment_id: i.equipmentId || null,
                    lab_id: i.labId || null,
                    lab_code: i.labCode || null,
                    pc_code: i.pcCode || null,
                    issue_type: i.issueType,
                    severity: i.severity || 'LOW',
                    priority: (i.severity || 'LOW').toUpperCase(),
                    status: i.status,
                    description: i.description,
                    resolution_notes: i.resolutionNotes || null,
                    created_at: i.createdAt,
                    updated_at: i.updatedAt || now,
                    synced_at: now
                }));
                const { error } = await this.client.from('issues').upsert(rows, { onConflict: 'id' });
                if (error) {
                    console.warn('[Supabase Sync] Error syncing issues:', error.message);
                }
                else {
                    this.stats.totalSyncedIssues += rows.length;
                    syncedCount += rows.length;
                }
            }
            // 3. Sync Maintenance Records (Technician Service Reports)
            if (payload.maintenance && payload.maintenance.length > 0) {
                const rows = payload.maintenance.map((m) => ({
                    id: m.id,
                    client_id: payload.clientId,
                    issue_id: m.issueId || null,
                    lab_id: m.labId,
                    lab_code: m.labCode || null,
                    computer_id: m.computerId || null,
                    equipment_id: m.equipmentId || null,
                    responsible_user: m.responsibleUser,
                    action_taken: m.actionTaken,
                    cost: m.cost || 0,
                    status: m.status,
                    notes: m.notes || null,
                    start_time: m.startTime,
                    end_time: m.endTime || null,
                    synced_at: now
                }));
                const { error } = await this.client.from('maintenance').upsert(rows, { onConflict: 'id' });
                if (error) {
                    console.warn('[Supabase Sync] Error syncing maintenance:', error.message);
                }
                else {
                    this.stats.totalSyncedMaintenance += rows.length;
                    syncedCount += rows.length;
                }
            }
            // 4. Sync Hardware Events (Peripheral Monitoring Reports)
            if (payload.hardwareEvents && payload.hardwareEvents.length > 0) {
                const rows = payload.hardwareEvents.map((h) => ({
                    id: h.id,
                    client_id: payload.clientId,
                    lab_id: h.labId,
                    lab_code: h.labCode,
                    computer_id: h.computerId,
                    pc_code: h.pcCode,
                    equipment_id: h.equipmentId || null,
                    session_id: h.sessionId || null,
                    event_type: h.eventType,
                    description: h.description,
                    metadata: h.metadata ? JSON.stringify(h.metadata) : null,
                    occurred_at: h.timestamp,
                    synced_at: now
                }));
                const { error } = await this.client.from('hardware_events').upsert(rows, { onConflict: 'id' });
                if (error) {
                    console.warn('[Supabase Sync] Error syncing hardware events:', error.message);
                }
                else {
                    this.stats.totalSyncedEvents += rows.length;
                    syncedCount += rows.length;
                }
            }
            // 5. Sync Audit Logs (Security & Access Logs)
            if (payload.auditLogs && payload.auditLogs.length > 0) {
                const rows = payload.auditLogs.map((a) => ({
                    id: a.id,
                    client_id: payload.clientId,
                    actor_user_id: a.actorUserId,
                    actor_name: a.actorName,
                    role: a.role,
                    action: a.action,
                    entity_type: a.entityType,
                    entity_id: a.entityId,
                    lab_id: a.labId || null,
                    metadata: a.metadata ? JSON.stringify(a.metadata) : null,
                    created_at: a.timestamp,
                    synced_at: now
                }));
                const { error } = await this.client.from('audit_logs').upsert(rows, { onConflict: 'id' });
                if (error) {
                    console.warn('[Supabase Sync] Error syncing audit logs:', error.message);
                }
                else {
                    this.stats.totalSyncedAuditLogs += rows.length;
                    syncedCount += rows.length;
                }
            }
            // 6. Record Consolidated Report Event in Supabase
            const reportEvent = {
                id: payload.batchId,
                client_id: payload.clientId,
                report_type: 'WORKSTATION_BATCH_SYNC',
                sessions_count: payload.sessions?.length || 0,
                issues_count: payload.issues?.length || 0,
                maintenance_count: payload.maintenance?.length || 0,
                hardware_events_count: payload.hardwareEvents?.length || 0,
                audit_logs_count: payload.auditLogs?.length || 0,
                submitted_at: payload.timestamp,
                synced_at: now
            };
            try {
                await this.client.from('lab_reports').upsert([reportEvent], { onConflict: 'id' });
            }
            catch {
                // Tolerated if table optional
            }
            this.stats.lastSyncedAt = now;
            this.stats.lastError = null;
            console.log(`[Supabase Sync] Successfully synchronized batch ${payload.batchId} (${syncedCount} total report records) into Supabase.`);
            return { success: true, syncedCount };
        }
        catch (e) {
            this.stats.lastError = e.message;
            console.error('[Supabase Sync] Batch sync error:', e.message);
            return { success: false, syncedCount, error: e.message };
        }
    }
}
exports.SupabaseSyncService = new SupabaseSyncEngine();
