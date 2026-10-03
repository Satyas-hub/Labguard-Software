"use strict";
// ============================================================================
// LABGUARD V2: Tamper-Resistant Institutional Audit Controller
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminAnalytics = exports.rejectAuditMutation = exports.exportAuditLogs = exports.getAuditMetadata = exports.getAuditLogById = exports.getAuditLogs = void 0;
const pool_1 = require("../db/pool");
/**
 * GET /api/audit-logs
 * Retrieves institutional audit logs with multi-parameter filtering, searching, and pagination.
 */
const getAuditLogs = async (req, res) => {
    const allLogs = pool_1.db.getStore('audit_logs');
    const { actorUserId, role, action, entityType, entityId, labId, search, dateFrom, dateTo, order = 'desc', limit, offset } = req.query;
    let filtered = [...allLogs];
    if (actorUserId && typeof actorUserId === 'string') {
        filtered = filtered.filter((l) => l.actorUserId === actorUserId);
    }
    if (role && typeof role === 'string') {
        filtered = filtered.filter((l) => l.role.toUpperCase() === role.toUpperCase());
    }
    if (action && typeof action === 'string') {
        const actionClean = action.trim().toUpperCase();
        filtered = filtered.filter((l) => l.action.toUpperCase().includes(actionClean));
    }
    if (entityType && typeof entityType === 'string') {
        const entityTypeClean = entityType.trim().toUpperCase();
        filtered = filtered.filter((l) => l.entityType.toUpperCase() === entityTypeClean);
    }
    if (entityId && typeof entityId === 'string') {
        filtered = filtered.filter((l) => l.entityId === entityId);
    }
    if (labId && typeof labId === 'string') {
        filtered = filtered.filter((l) => l.labId === labId);
    }
    if (search && typeof search === 'string') {
        const s = search.trim().toLowerCase();
        filtered = filtered.filter((l) => l.actorName.toLowerCase().includes(s) ||
            l.action.toLowerCase().includes(s) ||
            l.entityType.toLowerCase().includes(s) ||
            l.entityId.toLowerCase().includes(s));
    }
    if (dateFrom && typeof dateFrom === 'string') {
        const fromTime = new Date(dateFrom).getTime();
        filtered = filtered.filter((l) => new Date(l.timestamp).getTime() >= fromTime);
    }
    if (dateTo && typeof dateTo === 'string') {
        const toTime = new Date(dateTo).getTime();
        filtered = filtered.filter((l) => new Date(l.timestamp).getTime() <= toTime);
    }
    // Sorting
    filtered.sort((a, b) => {
        const tA = new Date(a.timestamp).getTime();
        const tB = new Date(b.timestamp).getTime();
        return order === 'asc' ? tA - tB : tB - tA;
    });
    const total = filtered.length;
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 200) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const paged = filtered.slice(parsedOffset, parsedOffset + parsedLimit);
    // Compute telemetry summary
    const distinctActors = new Set(allLogs.map((l) => l.actorUserId)).size;
    const distinctActions = Array.from(new Set(allLogs.map((l) => l.action)));
    const distinctEntityTypes = Array.from(new Set(allLogs.map((l) => l.entityType)));
    return res.json({
        success: true,
        data: paged,
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        summary: {
            distinctActorsCount: distinctActors,
            distinctActions,
            distinctEntityTypes
        }
    });
};
exports.getAuditLogs = getAuditLogs;
/**
 * GET /api/audit-logs/:id
 * Retrieves a single audit log entry by ID.
 */
const getAuditLogById = async (req, res) => {
    const { id } = req.params;
    const log = pool_1.db.findOne('audit_logs', (l) => l.id === id);
    if (!log) {
        return res.status(404).json({
            success: false,
            error: 'NOT_FOUND',
            message: 'Audit log record not found'
        });
    }
    return res.json({
        success: true,
        data: log
    });
};
exports.getAuditLogById = getAuditLogById;
/**
 * GET /api/audit-logs/metadata
 * Returns metadata summary of audit trail.
 */
const getAuditMetadata = async (_req, res) => {
    const allLogs = pool_1.db.getStore('audit_logs');
    const distinctActions = Array.from(new Set(allLogs.map((l) => l.action)));
    const distinctEntityTypes = Array.from(new Set(allLogs.map((l) => l.entityType)));
    const distinctRoles = Array.from(new Set(allLogs.map((l) => l.role)));
    return res.json({
        success: true,
        data: {
            totalRecords: allLogs.length,
            distinctActions,
            distinctEntityTypes,
            distinctRoles
        }
    });
};
exports.getAuditMetadata = getAuditMetadata;
/**
 * GET /api/audit-logs/export
 * Exports filtered audit trail to CSV or JSON format.
 */
const exportAuditLogs = async (req, res) => {
    const allLogs = pool_1.db.getStore('audit_logs');
    const { format = 'csv', action, entityType, role, search } = req.query;
    let filtered = [...allLogs];
    if (action && typeof action === 'string') {
        filtered = filtered.filter((l) => l.action.toUpperCase().includes(action.toUpperCase()));
    }
    if (entityType && typeof entityType === 'string') {
        filtered = filtered.filter((l) => l.entityType.toUpperCase() === entityType.toUpperCase());
    }
    if (role && typeof role === 'string') {
        filtered = filtered.filter((l) => l.role.toUpperCase() === role.toUpperCase());
    }
    if (search && typeof search === 'string') {
        const s = search.toLowerCase();
        filtered = filtered.filter((l) => l.actorName.toLowerCase().includes(s) || l.action.toLowerCase().includes(s));
    }
    // Newest first
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="labguard_audit_export.json"');
        return res.send(JSON.stringify(filtered, null, 2));
    }
    // Default CSV format
    const headers = ['ID', 'Timestamp', 'Actor Name', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Lab ID'];
    const rows = filtered.map((l) => [
        l.id,
        l.timestamp,
        `"${l.actorName.replace(/"/g, '""')}"`,
        l.role,
        l.action,
        l.entityType,
        l.entityId,
        l.labId || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="labguard_audit_export.csv"');
    return res.send(csvContent);
};
exports.exportAuditLogs = exportAuditLogs;
/**
 * Immutability Guard: Rejects any modification or deletion of audit logs.
 */
const rejectAuditMutation = async (_req, res) => {
    return res.status(403).json({
        success: false,
        error: 'IMMUTABLE_AUDIT_LOG',
        message: 'Audit logs are immutable and tamper-resistant by institutional policy. Deletion and modification are strictly prohibited.'
    });
};
exports.rejectAuditMutation = rejectAuditMutation;
/**
 * Real-time Institutional Analytics.
 * Rule: NO FAKE DATA. Returns exact count or 0/empty state.
 */
const getAdminAnalytics = async (_req, res) => {
    const users = pool_1.db.getStore('users');
    const labs = pool_1.db.getStore('labs');
    const computers = pool_1.db.getStore('computers');
    const equipment = pool_1.db.getStore('equipment');
    const sessions = pool_1.db.getStore('sessions');
    const issues = pool_1.db.getStore('issues');
    const clients = pool_1.db.getStore('clients');
    const totalStudents = users.filter((u) => u.role === 'STUDENT').length;
    const totalFaculty = users.filter((u) => u.role === 'FACULTY').length;
    const totalLabAssistants = users.filter((u) => u.role === 'LAB_ASSISTANT').length;
    const totalLabs = labs.length;
    const totalComputers = computers.length;
    const totalEquipment = equipment.length;
    const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length;
    const openIssues = issues.filter((i) => i.status === 'OPEN').length;
    const onlineClients = clients.filter((c) => c.isOnline).length;
    const offlineClients = clients.filter((c) => !c.isOnline).length;
    return res.json({
        success: true,
        data: {
            metrics: {
                totalStudents,
                totalFaculty,
                totalLabAssistants,
                totalLabs,
                totalComputers,
                totalEquipment,
                activeSessions,
                openIssues,
                onlineClients,
                offlineClients
            },
            recentActivity: pool_1.db.getStore('audit_logs').slice(-10).reverse()
        }
    });
};
exports.getAdminAnalytics = getAdminAnalytics;
