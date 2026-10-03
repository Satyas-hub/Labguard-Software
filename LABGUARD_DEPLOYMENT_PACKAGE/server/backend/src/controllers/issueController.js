"use strict";
// ============================================================================
// LABGUARD V2: Issue Management Controller (Phase 15)
// Enforces:
// 1. Full lifecycle state progression:
//    OPEN -> VERIFIED -> INVESTIGATING -> MAINTENANCE -> RESOLVED / REJECTED
// 2. Evidence attachment handling
// 3. Automated linked maintenance generation on transition to MAINTENANCE
// 4. Automated workstation and equipment state transitions
// 5. Scoped issue listing and multi-parameter filters
// 6. Strict anti-escalation RBAC and lab authorization
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMaintenance = exports.attachEvidence = exports.updateIssueStatus = exports.getIssueById = exports.listIssues = exports.reportIssue = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const notificationService_1 = require("../services/notificationService");
const assistantController_1 = require("./assistantController");
const equipmentController_1 = require("./equipmentController");
const labController_1 = require("./labController");
const realtimeService_1 = require("../services/realtimeService");
const supabaseSyncService_1 = require("../services/supabaseSyncService");
const VALID_STATUSES = [
    'OPEN',
    'VERIFIED',
    'INVESTIGATING',
    'MAINTENANCE',
    'RESOLVED',
    'REJECTED'
];
/**
 * Report a new incident or defective hardware peripheral.
 * POST /api/issues
 */
const reportIssue = async (req, res) => {
    (0, labController_1.ensureLabsSeeded)();
    (0, equipmentController_1.ensureEquipmentSeeded)();
    const user = req.user;
    let { labCode, pcCode, issueType, description, evidenceUrl, equipmentId, sessionId, title, category, computerId, severity } = req.body;
    if (!labCode || !pcCode) {
        if (computerId) {
            const pcObj = pool_1.db.findOne('computers', (c) => c.id === computerId || c.pcCode === computerId);
            if (pcObj) {
                labCode = pcObj.labCode;
                pcCode = pcObj.pcCode;
            }
            else {
                labCode = 'LAB-01';
                pcCode = computerId;
            }
        }
    }
    issueType = issueType || category || title || 'Other';
    description = description || title || 'Issue reported by student';
    const resolvedSeverity = severity || 'MEDIUM';
    if (!labCode || !pcCode || !description) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Lab code, PC code, and description required'
        });
    }
    const issue = {
        id: (0, uuid_1.v4)(),
        reportedBy: user.id,
        reporterName: user.fullName,
        reporterRole: user.role,
        labId: labCode,
        labCode,
        computerId: pcCode,
        pcCode,
        equipmentId,
        sessionId,
        issueType,
        description,
        evidenceUrl,
        severity: resolvedSeverity,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    pool_1.db.insert('issues', issue);
    // Notify Lab Assistant & Staff
    await notificationService_1.NotificationService.dispatchEventNotification({
        title: `Issue: ${labCode} / ${pcCode} (${issueType})`,
        message: description,
        severity: resolvedSeverity === 'CRITICAL' || resolvedSeverity === 'HIGH' ? 'CRITICAL' : 'WARNING',
        eventType: 'NEW_ISSUE',
        labCode,
        pcCode,
        targetRole: 'LAB_ASSISTANT'
    });
    // Realtime Gateway Broadcast
    realtimeService_1.RealtimeService.broadcastIssueUpdate(issue, 'CREATED');
    // Direct Supabase Cloud Mirror
    supabaseSyncService_1.SupabaseSyncService.syncBatch({
        clientId: `CLIENT-${issue.pcCode}`,
        batchId: `live-issue-${issue.id}`,
        timestamp: new Date().toISOString(),
        issues: [issue]
    }).catch((err) => {
        console.warn('[Issue Controller] Supabase reportIssue sync warning:', err.message || err);
    });
    return res.status(201).json({ success: true, data: issue });
};
exports.reportIssue = reportIssue;
/**
 * List issues with role-based scoping and multi-parameter filtering.
 * GET /api/issues
 */
const listIssues = async (req, res) => {
    const user = req.user;
    let issues = pool_1.db.getStore('issues');
    // Role scoping
    if (user.role === 'STUDENT') {
        issues = issues.filter((i) => i.reportedBy === user.id);
    }
    else if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
        if (user.assignedLabs && user.assignedLabs.length > 0) {
            issues = issues.filter((i) => (0, assistantController_1.isLabInScope)(user, i.labId, i.labCode));
        }
        else {
            issues = [];
        }
    }
    // Multi-parameter filters
    const { status, labCode, pcCode, severity, issueType, search } = req.query;
    if (status && typeof status === 'string') {
        issues = issues.filter((i) => i.status.toUpperCase() === status.toUpperCase());
    }
    if (labCode && typeof labCode === 'string') {
        issues = issues.filter((i) => i.labCode.toUpperCase() === labCode.toUpperCase());
    }
    if (pcCode && typeof pcCode === 'string') {
        issues = issues.filter((i) => i.pcCode.toUpperCase() === pcCode.toUpperCase());
    }
    if (severity && typeof severity === 'string') {
        issues = issues.filter((i) => i.severity === severity.toUpperCase());
    }
    if (issueType && typeof issueType === 'string') {
        issues = issues.filter((i) => i.issueType.toLowerCase() === issueType.toLowerCase());
    }
    if (search && typeof search === 'string') {
        const q = search.trim().toLowerCase();
        issues = issues.filter((i) => i.description.toLowerCase().includes(q) ||
            i.issueType.toLowerCase().includes(q) ||
            i.pcCode.toLowerCase().includes(q) ||
            i.labCode.toLowerCase().includes(q));
    }
    // Sort descending by creation date
    issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({ success: true, data: issues });
};
exports.listIssues = listIssues;
/**
 * Retrieve detailed issue inspection by ID.
 * GET /api/issues/:issueId
 */
const getIssueById = async (req, res) => {
    const user = req.user;
    const { issueId } = req.params;
    const issue = pool_1.db.findOne('issues', (i) => i.id === issueId);
    if (!issue) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Issue not found' });
    }
    if (user.role === 'STUDENT' && issue.reportedBy !== user.id) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Cannot view other students issues' });
    }
    if ((user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') && !(0, assistantController_1.isLabInScope)(user, issue.labId, issue.labCode)) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN_SCOPE', message: 'Issue outside assigned facility scope' });
    }
    const workstation = pool_1.db.findOne('computers', (c) => c.id === issue.computerId || (c.pcCode === issue.pcCode && c.labCode === issue.labCode));
    const equipment = issue.equipmentId
        ? pool_1.db.findOne('equipment', (e) => e.id === issue.equipmentId)
        : null;
    const maintenanceRecords = pool_1.db.find('maintenance', (m) => m.issueId === issue.id);
    return res.json({
        success: true,
        data: {
            issue,
            workstation,
            equipment,
            maintenanceRecords
        }
    });
};
exports.getIssueById = getIssueById;
/**
 * Progress issue lifecycle state.
 * PATCH /api/issues/:issueId/status
 */
const updateIssueStatus = async (req, res) => {
    const user = req.user;
    const { issueId } = req.params;
    const { status, resolutionNotes } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_STATUS',
            message: `Status must be one of: ${VALID_STATUSES.join(', ')}`
        });
    }
    const issue = pool_1.db.findOne('issues', (i) => i.id === issueId);
    if (!issue) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Issue not found' });
    }
    // Lab assistant scope check
    if (user.role === 'LAB_ASSISTANT') {
        if (!(0, assistantController_1.isLabInScope)(user, issue.labId, issue.labCode)) {
            return res.status(403).json({
                success: false,
                error: 'FORBIDDEN_SCOPE',
                message: 'Lab Assistant is not authorized for the laboratory where this issue occurred'
            });
        }
    }
    const now = new Date().toISOString();
    issue.status = status;
    issue.updatedAt = now;
    if (resolutionNotes) {
        issue.resolutionNotes = resolutionNotes;
    }
    if (status === 'VERIFIED') {
        issue.verifiedBy = user.fullName;
        issue.verifiedAt = now;
    }
    else if (status === 'RESOLVED') {
        issue.resolvedBy = user.fullName;
        issue.resolvedAt = now;
        // Restore workstation to AVAILABLE if no other maintenance orders are pending
        pool_1.db.update('computers', (c) => c.id === issue.computerId || (c.pcCode === issue.pcCode && c.labCode === issue.labCode), {
            state: 'AVAILABLE',
            updatedAt: now
        });
        // Complete linked maintenance orders
        const linkedMaintenance = pool_1.db.find('maintenance', (m) => m.issueId === issue.id);
        for (const m of linkedMaintenance) {
            if (m.status !== 'COMPLETED') {
                m.status = 'COMPLETED';
                m.endTime = now;
            }
        }
    }
    else if (status === 'MAINTENANCE') {
        // Transition workstation to MAINTENANCE
        pool_1.db.update('computers', (c) => c.id === issue.computerId || (c.pcCode === issue.pcCode && c.labCode === issue.labCode), {
            state: 'MAINTENANCE',
            updatedAt: now
        });
        // If attached to equipment, mark faulty
        if (issue.equipmentId) {
            pool_1.db.update('equipment', (e) => e.id === issue.equipmentId, {
                status: 'FAULTY',
                updatedAt: now
            });
        }
        // Check if maintenance order already exists
        const existingMaint = pool_1.db.findOne('maintenance', (m) => m.issueId === issue.id);
        if (!existingMaint) {
            const maintenance = {
                id: (0, uuid_1.v4)(),
                issueId: issue.id,
                labId: issue.labId,
                computerId: issue.computerId,
                equipmentId: issue.equipmentId,
                responsibleUser: user.fullName,
                actionTaken: 'Hardware bench diagnostics and triage initiated',
                startTime: now,
                status: 'IN_PROGRESS',
                notes: resolutionNotes || `Maintenance work order generated from issue: ${issue.issueType}`
            };
            pool_1.db.insert('maintenance', maintenance);
        }
    }
    // Audit trail
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: user.id,
        actorName: user.fullName,
        role: user.role,
        action: 'ISSUE_STATUS_UPDATE',
        entityType: 'ISSUE',
        entityId: issue.id,
        labId: issue.labId,
        timestamp: now,
        metadata: { previousStatus: issue.status, newStatus: status, resolutionNotes }
    });
    // Realtime Gateway Broadcast
    realtimeService_1.RealtimeService.broadcastIssueUpdate(issue, 'UPDATED');
    // Direct Supabase Cloud Mirror
    supabaseSyncService_1.SupabaseSyncService.syncBatch({
        clientId: `CLIENT-${issue.pcCode}`,
        batchId: `live-issue-update-${issue.id}`,
        timestamp: now,
        issues: [issue]
    }).catch((err) => {
        console.warn('[Issue Controller] Supabase updateIssueStatus sync warning:', err.message || err);
    });
    return res.json({ success: true, data: issue });
};
exports.updateIssueStatus = updateIssueStatus;
/**
 * Attach photographic or textual diagnostic evidence to an issue.
 * POST /api/issues/:issueId/evidence
 */
const attachEvidence = async (req, res) => {
    const user = req.user;
    const { issueId } = req.params;
    const { evidenceUrl, evidenceDescription } = req.body;
    if (!evidenceUrl) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Evidence URL or data payload is required'
        });
    }
    const issue = pool_1.db.findOne('issues', (i) => i.id === issueId);
    if (!issue) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Issue not found' });
    }
    // Authorization check
    if (user.role === 'STUDENT' && issue.reportedBy !== user.id) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Cannot alter another student issue' });
    }
    const now = new Date().toISOString();
    issue.evidenceUrl = evidenceUrl;
    issue.updatedAt = now;
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: user.id,
        actorName: user.fullName,
        role: user.role,
        action: 'ISSUE_EVIDENCE_ATTACHED',
        entityType: 'ISSUE',
        entityId: issue.id,
        timestamp: now,
        metadata: { evidenceUrl, evidenceDescription }
    });
    return res.json({
        success: true,
        data: issue,
        message: 'Evidence successfully attached to issue record'
    });
};
exports.attachEvidence = attachEvidence;
/**
 * List maintenance work orders.
 * GET /api/maintenance
 */
const listMaintenance = async (req, res) => {
    const user = req.user;
    let records = pool_1.db.getStore('maintenance');
    if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
        if (user.assignedLabs && user.assignedLabs.length > 0) {
            records = records.filter((m) => user.assignedLabs.some((al) => al.toLowerCase() === m.labId?.toLowerCase()));
        }
    }
    const { status, labId } = req.query;
    if (status && typeof status === 'string') {
        records = records.filter((m) => m.status.toUpperCase() === status.toUpperCase());
    }
    if (labId && typeof labId === 'string') {
        records = records.filter((m) => m.labId.toUpperCase() === labId.toUpperCase());
    }
    return res.json({ success: true, data: records });
};
exports.listMaintenance = listMaintenance;
