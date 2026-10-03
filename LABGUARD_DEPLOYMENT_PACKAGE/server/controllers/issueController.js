"use strict";
// ============================================================================
// LABGUARD V2: Issue & Maintenance Controller
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMaintenance = exports.updateIssueStatus = exports.listIssues = exports.reportIssue = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const notificationService_1 = require("../services/notificationService");
const reportIssue = async (req, res) => {
    const user = req.user;
    const { labCode, pcCode, issueType, description, evidenceUrl, equipmentId, sessionId } = req.body;
    if (!labCode || !pcCode || !issueType || !description) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Lab code, PC code, issue type, and description required' });
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
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    pool_1.db.insert('issues', issue);
    // Notify Lab Assistant
    await notificationService_1.NotificationService.dispatchEventNotification({
        title: `Issue: ${labCode} / ${pcCode} (${issueType})`,
        message: description,
        severity: 'WARNING',
        eventType: 'NEW_ISSUE',
        labCode,
        pcCode,
        targetRole: 'LAB_ASSISTANT'
    });
    return res.status(201).json({ success: true, data: issue });
};
exports.reportIssue = reportIssue;
const listIssues = async (req, res) => {
    const user = req.user;
    let issues = pool_1.db.getStore('issues');
    if (user.role === 'STUDENT') {
        issues = issues.filter((i) => i.reportedBy === user.id);
    }
    return res.json({ success: true, data: issues });
};
exports.listIssues = listIssues;
const updateIssueStatus = async (req, res) => {
    const { issueId } = req.params;
    const { status, resolutionNotes } = req.body;
    const issue = pool_1.db.findOne('issues', (i) => i.id === issueId);
    if (!issue) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    }
    issue.status = status;
    issue.updatedAt = new Date().toISOString();
    // If moved to maintenance
    if (status === 'MAINTENANCE') {
        const maintenance = {
            id: (0, uuid_1.v4)(),
            issueId: issue.id,
            labId: issue.labId,
            computerId: issue.computerId,
            responsibleUser: req.user.fullName,
            actionTaken: 'Investigation and bench repair initiated',
            startTime: new Date().toISOString(),
            status: 'IN_PROGRESS',
            notes: resolutionNotes
        };
        pool_1.db.insert('maintenance', maintenance);
    }
    return res.json({ success: true, data: issue });
};
exports.updateIssueStatus = updateIssueStatus;
const listMaintenance = async (_req, res) => {
    const records = pool_1.db.getStore('maintenance');
    return res.json({ success: true, data: records });
};
exports.listMaintenance = listMaintenance;
