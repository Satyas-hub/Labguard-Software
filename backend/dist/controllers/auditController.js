"use strict";
// ============================================================================
// LABGUARD V2: Audit & Analytics Controller (Real Data, Zero Fake Metrics)
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminAnalytics = exports.getAuditLogs = void 0;
const pool_1 = require("../db/pool");
const getAuditLogs = async (_req, res) => {
    const logs = pool_1.db.getStore('audit_logs');
    return res.json({ success: true, data: logs });
};
exports.getAuditLogs = getAuditLogs;
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
