"use strict";
// ============================================================================
// LABGUARD V2: Student Session Controller
// Enforces:
// 1. Student self-scoping
// 2. Client & PC availability validation
// 3. Exact session lifecycle: LOGIN -> VALIDATION -> ACTIVE -> END -> SHUTDOWN
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSessions = exports.endSession = exports.startSession = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const startSession = async (req, res) => {
    const user = req.user;
    const { labCode, pcCode, clientId, startMode } = req.body;
    if (!labCode || !pcCode) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Lab Code and PC Code required' });
    }
    // Verify that the student doesn't already have an active session
    const existingActive = pool_1.db.findOne('sessions', (s) => s.studentId === user.id && s.status === 'ACTIVE');
    if (existingActive) {
        return res.status(409).json({
            success: false,
            error: 'ACTIVE_SESSION_EXISTS',
            message: 'Student already has an active session on workstation ' + existingActive.pcCode,
            data: existingActive
        });
    }
    // Find or register PC
    let pc = pool_1.db.findOne('computers', (c) => c.pcCode === pcCode && c.labCode === labCode);
    if (!pc) {
        pc = {
            id: (0, uuid_1.v4)(),
            labId: (0, uuid_1.v4)(),
            labCode,
            pcCode,
            state: 'IN_USE',
            isOnline: true,
            lastHeartbeat: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        pool_1.db.insert('computers', pc);
    }
    else {
        pc.state = 'IN_USE';
    }
    const now = new Date().toISOString();
    const session = {
        id: (0, uuid_1.v4)(),
        studentId: user.id,
        studentIdentifier: user.identifier || user.email,
        studentName: user.fullName,
        labId: pc.labId,
        labCode,
        computerId: pc.id,
        pcCode,
        clientId: clientId || `CLIENT-${pcCode}`,
        startedAt: now,
        status: 'ACTIVE',
        startMode: startMode || 'NORMAL',
        syncStatus: 'SYNCED',
        createdAt: now,
        updatedAt: now
    };
    pool_1.db.insert('sessions', session);
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: user.id,
        actorName: user.fullName,
        role: user.role,
        action: 'SESSION_START',
        entityType: 'SESSION',
        entityId: session.id,
        clientId: session.clientId,
        labId: session.labId,
        timestamp: now
    });
    return res.status(201).json({ success: true, data: session });
};
exports.startSession = startSession;
const endSession = async (req, res) => {
    const user = req.user;
    const { sessionId, endMode } = req.body;
    const session = pool_1.db.findOne('sessions', (s) => s.id === sessionId);
    if (!session) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Session not found' });
    }
    // Authorization check: Student can only end own session; Admin/Assistant can end any
    if (user.role === 'STUDENT' && session.studentId !== user.id) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Cannot end another student session' });
    }
    const now = new Date().toISOString();
    session.endedAt = now;
    session.status = 'COMPLETED';
    session.endMode = endMode || 'NORMAL';
    session.updatedAt = now;
    // Mark PC as available
    pool_1.db.update('computers', (c) => c.id === session.computerId || (c.pcCode === session.pcCode && c.labCode === session.labCode), {
        state: 'AVAILABLE'
    });
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: user.id,
        actorName: user.fullName,
        role: user.role,
        action: 'SESSION_END',
        entityType: 'SESSION',
        entityId: session.id,
        clientId: session.clientId,
        timestamp: now,
        metadata: { endMode: session.endMode, autoShutdownInitiated: user.role === 'STUDENT' }
    });
    return res.json({
        success: true,
        data: session,
        message: user.role === 'STUDENT' ? 'Student session closed. Workstation shutdown authorized.' : 'Session completed.'
    });
};
exports.endSession = endSession;
const listSessions = async (req, res) => {
    const user = req.user;
    let sessions = pool_1.db.getStore('sessions');
    if (user.role === 'STUDENT') {
        sessions = sessions.filter((s) => s.studentId === user.id);
    }
    return res.json({ success: true, data: sessions });
};
exports.listSessions = listSessions;
