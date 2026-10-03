"use strict";
// ============================================================================
// LABGUARD V2: Lab Session System Controller (Phase 13)
// Enforces:
// 1. Full Lifecycle State Machine:
//    LOGIN -> PC_VALIDATION -> AUTHORIZATION -> HARDWARE_CHECK -> SESSION_START -> ACTIVE -> END_SESSION -> SHUTDOWN
// 2. Duplicate session prevention (Student cannot have 2 active sessions)
// 3. Workstation occupancy collision prevention (Workstation cannot have 2 active sessions)
// 4. Workstation state pre-condition checks (MAINTENANCE / DISABLED blocking)
// 5. Active session heartbeat and duration telemetry
// 6. Multi-role session termination (Student Normal, Forced End, Timeout, Shutdown)
// 7. Strict RBAC and facility scoping
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverCrashedSession = exports.getSessionById = exports.getActiveSessions = exports.listSessions = exports.cancelSession = exports.forceEndSession = exports.endSession = exports.heartbeatSession = exports.startSession = exports.validatePreSession = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const realtimeService_1 = require("../services/realtimeService");
const supabaseSyncService_1 = require("../services/supabaseSyncService");
const equipmentController_1 = require("./equipmentController");
const labController_1 = require("./labController");
/**
 * Pre-flight session validation endpoint.
 * Validates PC existence, availability, student authorization, and hardware integrity.
 * POST /api/sessions/validate
 */
const validatePreSession = async (req, res) => {
    (0, labController_1.ensureLabsSeeded)();
    (0, equipmentController_1.ensureEquipmentSeeded)();
    const user = req.user;
    let { labCode, pcCode, computerId } = req.body;
    if (!labCode || !pcCode) {
        if (computerId) {
            const pcObj = pool_1.db.findOne('computers', (c) => c.id === computerId || c.pcCode === computerId);
            if (pcObj) {
                labCode = pcObj.labCode;
                pcCode = pcObj.pcCode;
            }
        }
    }
    if (!labCode || !pcCode) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Lab Code and PC Code are required for session validation'
        });
    }
    // 1. Check if student already has an active session elsewhere
    const studentActive = pool_1.db.findOne('sessions', (s) => s.studentId === user.id && s.status === 'ACTIVE');
    if (studentActive) {
        const isSamePc = (studentActive.pcCode === pcCode && studentActive.labCode === labCode) || (computerId && studentActive.computerId === computerId);
        if (req.body.autoRecover || req.body.forceRecover || isSamePc) {
            studentActive.status = 'RECOVERED';
            studentActive.endedAt = new Date().toISOString();
            studentActive.endMode = 'CRASH_RECOVERED';
            studentActive.notes = (studentActive.notes ? studentActive.notes + ' | ' : '') + 'Recovered during pre-session validation';
            studentActive.updatedAt = new Date().toISOString();
        }
        else {
            return res.status(409).json({
                success: false,
                error: 'ACTIVE_SESSION_EXISTS',
                message: `You already have an active session on workstation ${studentActive.pcCode} in ${studentActive.labCode}`,
                data: studentActive
            });
        }
    }
    // 2. Find target PC
    const pc = pool_1.db.findOne('computers', (c) => (c.pcCode === pcCode && c.labCode === labCode) || (computerId && c.id === computerId));
    if (!pc) {
        return res.status(404).json({
            success: false,
            error: 'PC_NOT_FOUND',
            message: `Workstation ${pcCode} in ${labCode} is not registered in the institutional fleet`
        });
    }
    // 3. Check workstation operational state
    if (pc.state === 'MAINTENANCE' || pc.state === 'DISABLED') {
        return res.status(403).json({
            success: false,
            error: 'COMPUTER_UNAVAILABLE',
            message: `Workstation ${pcCode} is currently in ${pc.state} mode and cannot host student sessions`
        });
    }
    // 4. Check workstation occupancy (another student active)
    const workstationOccupied = pool_1.db.findOne('sessions', (s) => s.status === 'ACTIVE' &&
        ((s.computerId && s.computerId === pc.id) || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)) &&
        s.studentId !== user.id);
    if (workstationOccupied) {
        if (req.body.autoRecover || req.body.forceRecover) {
            workstationOccupied.status = 'RECOVERED';
            workstationOccupied.endedAt = new Date().toISOString();
            workstationOccupied.endMode = 'CRASH_RECOVERED';
            workstationOccupied.notes = (workstationOccupied.notes ? workstationOccupied.notes + ' | ' : '') + 'Workstation cleared via crash recovery';
            workstationOccupied.updatedAt = new Date().toISOString();
        }
        else {
            return res.status(409).json({
                success: false,
                error: 'COMPUTER_OCCUPIED',
                message: `Workstation ${pcCode} in ${labCode} is currently in use by another student (${workstationOccupied.studentName || 'Student'})`,
                data: workstationOccupied
            });
        }
    }
    // 5. Hardware Peripheral Health Check
    const allEquip = pool_1.db.getStore('equipment');
    const attachedEquipment = allEquip.filter((e) => e.computerId === pc.id || (e.pcCode === pc.pcCode && e.labCode === pc.labCode));
    const faultyPeripherals = attachedEquipment.filter((e) => e.status === 'FAULTY');
    return res.json({
        success: true,
        data: {
            allowed: true,
            workstation: pc,
            attachedEquipment,
            hasFaultyEquipment: faultyPeripherals.length > 0,
            faultyPeripherals: faultyPeripherals.map((e) => ({ id: e.id, type: e.type, assetTag: e.assetTag })),
            student: {
                id: user.id,
                fullName: user.fullName,
                identifier: user.identifier,
                email: user.email
            }
        }
    });
};
exports.validatePreSession = validatePreSession;
/**
 * Initiates an authorized student lab session.
 * Prevents duplicates (student or computer) and transitions PC to IN_USE.
 * POST /api/sessions/start
 */
const startSession = async (req, res) => {
    (0, labController_1.ensureLabsSeeded)();
    (0, equipmentController_1.ensureEquipmentSeeded)();
    const user = req.user;
    let { labCode, pcCode, clientId, startMode, computerId } = req.body;
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
    if (!labCode || !pcCode) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Lab Code and PC Code required'
        });
    }
    // 1. Verify that the student doesn't already have an active session
    const existingActive = pool_1.db.findOne('sessions', (s) => s.studentId === user.id && s.status === 'ACTIVE');
    if (existingActive) {
        const isSamePc = (existingActive.pcCode === pcCode && existingActive.labCode === labCode) || (computerId && existingActive.computerId === computerId);
        if (req.body.autoRecover || req.body.forceRecover || isSamePc) {
            existingActive.status = 'RECOVERED';
            existingActive.endedAt = new Date().toISOString();
            existingActive.endMode = 'CRASH_RECOVERED';
            existingActive.notes = (existingActive.notes ? existingActive.notes + ' | ' : '') + 'Recovered during session start';
            existingActive.updatedAt = new Date().toISOString();
        }
        else {
            return res.status(409).json({
                success: false,
                error: 'ACTIVE_SESSION_EXISTS',
                message: 'Student already has an active session on workstation ' + existingActive.pcCode,
                data: existingActive
            });
        }
    }
    // 2. Find or register PC
    let pc = pool_1.db.findOne('computers', (c) => (c.pcCode === pcCode && c.labCode === labCode) || (computerId && c.id === computerId));
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
        // 3. Pre-condition checks on existing workstation
        if (pc.state === 'MAINTENANCE' || pc.state === 'DISABLED') {
            return res.status(403).json({
                success: false,
                error: 'COMPUTER_UNAVAILABLE',
                message: `Workstation ${pcCode} is currently in ${pc.state} mode and cannot host sessions.`
            });
        }
        // 4. Check for workstation occupancy collision
        const workstationOccupied = pool_1.db.findOne('sessions', (s) => s.status === 'ACTIVE' &&
            ((s.computerId && s.computerId === pc.id) || (s.pcCode === pc.pcCode && s.labCode === pc.labCode)) &&
            s.studentId !== user.id);
        if (workstationOccupied) {
            if (req.body.autoRecover || req.body.forceRecover) {
                workstationOccupied.status = 'RECOVERED';
                workstationOccupied.endedAt = new Date().toISOString();
                workstationOccupied.endMode = 'CRASH_RECOVERED';
                workstationOccupied.notes = (workstationOccupied.notes ? workstationOccupied.notes + ' | ' : '') + 'Workstation cleared via crash recovery';
                workstationOccupied.updatedAt = new Date().toISOString();
            }
            else {
                return res.status(409).json({
                    success: false,
                    error: 'COMPUTER_OCCUPIED',
                    message: `Workstation ${pcCode} in ${labCode} is already occupied by another student`,
                    data: workstationOccupied
                });
            }
        }
        pc.state = 'IN_USE';
        pc.updatedAt = new Date().toISOString();
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
    // Realtime Gateway Broadcast
    realtimeService_1.RealtimeService.broadcastSessionStart(session);
    // Direct Supabase Cloud Mirror
    supabaseSyncService_1.SupabaseSyncService.syncBatch({
        clientId: session.clientId,
        batchId: `live-${session.id}`,
        timestamp: now,
        sessions: [session]
    }).catch((err) => {
        console.warn('[Session Controller] Supabase session start sync warning:', err.message || err);
    });
    return res.status(201).json({ success: true, data: session });
};
exports.startSession = startSession;
/**
 * Session Heartbeat / Keep-Alive.
 * Records continuous telemetry and returns active session duration.
 * POST /api/sessions/:id/heartbeat
 */
const heartbeatSession = async (req, res) => {
    const user = req.user;
    const sessionId = req.params.id || req.body.sessionId || req.body.id;
    const session = pool_1.db.findOne('sessions', (s) => s.id === sessionId);
    if (!session) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Session not found' });
    }
    if (user.role === 'STUDENT' && session.studentId !== user.id) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Cannot heartbeat another student session' });
    }
    if (session.status !== 'ACTIVE') {
        return res.status(400).json({
            success: false,
            error: 'SESSION_INACTIVE',
            message: `Session is not active (current status: ${session.status})`,
            data: session
        });
    }
    const now = new Date().toISOString();
    session.updatedAt = now;
    // Touch PC heartbeat
    pool_1.db.update('computers', (c) => c.id === session.computerId || (c.pcCode === session.pcCode && c.labCode === session.labCode), {
        lastHeartbeat: now,
        isOnline: true
    });
    // Calculate elapsed minutes
    const elapsedMs = new Date(now).getTime() - new Date(session.startedAt).getTime();
    const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
    return res.json({
        success: true,
        data: {
            sessionId: session.id,
            status: session.status,
            elapsedMinutes,
            lastHeartbeat: now
        }
    });
};
exports.heartbeatSession = heartbeatSession;
/**
 * Normal session conclusion.
 * Marks session COMPLETED and sets PC to AVAILABLE.
 * POST /api/sessions/end or POST /api/sessions/:id/end
 */
const endSession = async (req, res) => {
    const user = req.user;
    const sessionId = req.params.id || req.body.sessionId || req.body.id;
    const { endMode } = req.body;
    const session = pool_1.db.findOne('sessions', (s) => s.id === sessionId);
    if (!session) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Session not found' });
    }
    // Authorization check: Student can only end own session; Admin/Assistant/Faculty can end any
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
    // Realtime Gateway Broadcast
    realtimeService_1.RealtimeService.broadcastSessionEnd(session);
    // Direct Supabase Cloud Mirror
    supabaseSyncService_1.SupabaseSyncService.syncBatch({
        clientId: session.clientId,
        batchId: `live-end-${session.id}`,
        timestamp: now,
        sessions: [session]
    }).catch((err) => {
        console.warn('[Session Controller] Supabase session end sync warning:', err.message || err);
    });
    return res.json({
        success: true,
        data: session,
        message: user.role === 'STUDENT' ? 'Student session closed. Workstation shutdown authorized.' : 'Session completed.'
    });
};
exports.endSession = endSession;
/**
 * Force-terminate student session.
 * Administrative authority (Admin, Faculty, Lab Assistant).
 * POST /api/sessions/:id/force-end
 */
const forceEndSession = async (req, res) => {
    const user = req.user;
    const sessionId = req.params.id || req.body.sessionId;
    const { reason } = req.body;
    if (user.role === 'STUDENT') {
        return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Students cannot force-terminate sessions'
        });
    }
    const session = pool_1.db.findOne('sessions', (s) => s.id === sessionId);
    if (!session) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Session not found' });
    }
    const now = new Date().toISOString();
    session.endedAt = now;
    session.status = 'FORCED_END';
    session.endMode = 'FORCED_END';
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
        action: 'SESSION_FORCE_END',
        entityType: 'SESSION',
        entityId: session.id,
        clientId: session.clientId,
        timestamp: now,
        metadata: { reason: reason || 'Administrative session termination by ' + user.fullName }
    });
    // Realtime Gateway Broadcast
    realtimeService_1.RealtimeService.broadcastSessionEnd(session);
    // Direct Supabase Cloud Mirror
    supabaseSyncService_1.SupabaseSyncService.syncBatch({
        clientId: session.clientId,
        batchId: `live-force-${session.id}`,
        timestamp: now,
        sessions: [session]
    }).catch((err) => {
        console.warn('[Session Controller] Supabase session force-end sync warning:', err.message || err);
    });
    return res.json({
        success: true,
        data: session,
        message: `Session force-terminated by ${user.role}`
    });
};
exports.forceEndSession = forceEndSession;
/**
 * Cancel session before active usage.
 * POST /api/sessions/:id/cancel
 */
const cancelSession = async (req, res) => {
    const user = req.user;
    const sessionId = req.params.id || req.body.sessionId;
    const session = pool_1.db.findOne('sessions', (s) => s.id === sessionId);
    if (!session) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Session not found' });
    }
    if (user.role === 'STUDENT' && session.studentId !== user.id) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Cannot cancel another student session' });
    }
    const now = new Date().toISOString();
    session.endedAt = now;
    session.status = 'CANCELLED';
    session.endMode = 'NORMAL';
    session.updatedAt = now;
    // Mark PC as available
    pool_1.db.update('computers', (c) => c.id === session.computerId || (c.pcCode === session.pcCode && c.labCode === session.labCode), {
        state: 'AVAILABLE'
    });
    // Realtime Gateway Broadcast
    realtimeService_1.RealtimeService.broadcastSessionEnd(session);
    return res.json({
        success: true,
        data: session,
        message: 'Session cancelled'
    });
};
exports.cancelSession = cancelSession;
/**
 * List sessions with strict role-based scoping.
 * GET /api/sessions
 */
const listSessions = async (req, res) => {
    const user = req.user;
    let sessions = pool_1.db.getStore('sessions');
    if (user.role === 'STUDENT') {
        sessions = sessions.filter((s) => s.studentId === user.id);
    }
    else if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
        if (user.assignedLabs && user.assignedLabs.length > 0) {
            sessions = sessions.filter((s) => user.assignedLabs.some((al) => al.toLowerCase() === s.labCode?.toLowerCase() || al === s.labId));
        }
    }
    // Support status query filter (e.g. ?status=ACTIVE)
    const { status } = req.query;
    if (status && typeof status === 'string') {
        sessions = sessions.filter((s) => s.status.toUpperCase() === status.toUpperCase());
    }
    return res.json({ success: true, data: sessions });
};
exports.listSessions = listSessions;
/**
 * Query currently active sessions.
 * GET /api/sessions/active
 */
const getActiveSessions = async (req, res) => {
    const user = req.user;
    let sessions = pool_1.db.getStore('sessions');
    if (user.role === 'STUDENT') {
        sessions = sessions.filter((s) => s.studentId === user.id && s.status === 'ACTIVE');
    }
    else if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
        if (user.assignedLabs && user.assignedLabs.length > 0) {
            sessions = sessions.filter((s) => s.status === 'ACTIVE' &&
                user.assignedLabs.some((al) => al.toLowerCase() === s.labCode?.toLowerCase() || al === s.labId));
        }
        else {
            sessions = sessions.filter((s) => s.status === 'ACTIVE');
        }
    }
    else {
        sessions = sessions.filter((s) => s.status === 'ACTIVE');
    }
    return res.json({
        success: true,
        data: {
            count: sessions.length,
            activeSessions: sessions
        }
    });
};
exports.getActiveSessions = getActiveSessions;
/**
 * Retrieve specific session by ID with workstation and equipment inspection.
 * GET /api/sessions/:id
 */
const getSessionById = async (req, res) => {
    const user = req.user;
    const session = pool_1.db.findOne('sessions', (s) => s.id === req.params.id);
    if (!session) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Session not found' });
    }
    if (user.role === 'STUDENT' && session.studentId !== user.id) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Cannot access another student session' });
    }
    const workstation = pool_1.db.findOne('computers', (c) => c.id === session.computerId || (c.pcCode === session.pcCode && c.labCode === session.labCode));
    const allEquip = pool_1.db.getStore('equipment');
    const attachedEquipment = workstation
        ? allEquip.filter((e) => e.computerId === workstation.id || (e.pcCode === workstation.pcCode && e.labCode === workstation.labCode))
        : [];
    return res.json({
        success: true,
        data: {
            session,
            workstation,
            attachedEquipment
        }
    });
};
exports.getSessionById = getSessionById;
/**
 * Recovers orphaned active session(s) following an abnormal application termination,
 * power outage, or workstation crash.
 * POST /api/sessions/recover
 */
const recoverCrashedSession = async (req, res) => {
    (0, labController_1.ensureLabsSeeded)();
    (0, equipmentController_1.ensureEquipmentSeeded)();
    const user = req.user;
    const { labCode, pcCode, computerId, clientId, sessionId, studentId, reason } = req.body;
    let targetSessions = [];
    if (sessionId) {
        const s = pool_1.db.findOne('sessions', (sess) => sess.id === sessionId && sess.status === 'ACTIVE');
        if (s)
            targetSessions.push(s);
    }
    else {
        targetSessions = pool_1.db.find('sessions', (sess) => {
            if (sess.status !== 'ACTIVE')
                return false;
            if (user.role === 'STUDENT' && sess.studentId === user.id)
                return true;
            if (studentId && sess.studentId === studentId)
                return true;
            if (computerId && sess.computerId === computerId)
                return true;
            if (labCode && pcCode && sess.labCode?.toUpperCase() === labCode.toUpperCase() && sess.pcCode?.toUpperCase() === pcCode.toUpperCase())
                return true;
            if (clientId && sess.clientId === clientId)
                return true;
            return false;
        });
    }
    if (targetSessions.length === 0) {
        return res.json({
            success: true,
            message: 'No active orphaned sessions found requiring recovery',
            recoveredCount: 0,
            data: []
        });
    }
    const recoveredList = [];
    const now = new Date().toISOString();
    for (const sess of targetSessions) {
        sess.status = 'RECOVERED';
        sess.endedAt = now;
        sess.endMode = 'CRASH_RECOVERED';
        sess.notes = (sess.notes ? sess.notes + ' | ' : '') + (reason || 'Recovered after abnormal application termination/crash');
        sess.updatedAt = now;
        const startTime = new Date(sess.startedAt).getTime();
        const endTime = new Date(now).getTime();
        sess.durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
        // Restore workstation state to AVAILABLE if no other active sessions exist
        const otherActive = pool_1.db.findOne('sessions', (other) => other.id !== sess.id &&
            other.status === 'ACTIVE' &&
            ((other.computerId && other.computerId === sess.computerId) ||
                (other.pcCode === sess.pcCode && other.labCode === sess.labCode)));
        if (!otherActive) {
            const pcObj = pool_1.db.findOne('computers', (c) => c.id === sess.computerId || (c.pcCode === sess.pcCode && c.labCode === sess.labCode));
            if (pcObj && pcObj.state === 'IN_USE') {
                pcObj.state = 'AVAILABLE';
                pcObj.updatedAt = now;
                realtimeService_1.RealtimeService.broadcastWorkstationState(pcObj);
            }
        }
        // Broadcast session end over WebSocket
        realtimeService_1.RealtimeService.broadcastSessionEnd(sess);
        // Audit trail logging
        pool_1.db.insert('audit_logs', {
            id: (0, uuid_1.v4)(),
            actorUserId: user.id,
            actorName: user.fullName,
            actorRole: user.role,
            action: 'SESSION_RECOVERED',
            entityType: 'SESSION',
            entityId: sess.id,
            labCode: sess.labCode,
            pcCode: sess.pcCode,
            details: {
                previousStatus: 'ACTIVE',
                newStatus: 'RECOVERED',
                endMode: 'CRASH_RECOVERED',
                reason: reason || 'Abnormal shutdown/crash recovery'
            },
            timestamp: now,
            createdAt: now
        });
        recoveredList.push(sess);
    }
    return res.json({
        success: true,
        message: `Successfully recovered ${recoveredList.length} orphaned session(s)`,
        recoveredCount: recoveredList.length,
        data: recoveredList
    });
};
exports.recoverCrashedSession = recoverCrashedSession;
