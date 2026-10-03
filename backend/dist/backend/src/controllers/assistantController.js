"use strict";
// ============================================================================
// LABGUARD V2: Lab Assistant Operational Controller
// Enforces:
// 1. Strict operational scoping to assigned laboratories
// 2. Real-time fleet occupancy and telemetry aggregation
// 3. Hardware peripheral event stream and acknowledgment
// 4. End-to-end maintenance lifecycle management
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelMaintenanceRecord = exports.getMaintenanceById = exports.getMaintenanceStats = exports.updateMaintenanceRecord = exports.createMaintenanceRecord = exports.acknowledgeHardwareEvent = exports.createHardwareEvent = exports.getHardwareEvents = exports.getAssistantDashboard = exports.isLabInScope = exports.ensureHardwareEventsSeeded = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("../db/pool");
const labController_1 = require("./labController");
const realtimeService_1 = require("../services/realtimeService");
/**
 * Ensures clean initial hardware event store. Demo hardware event seeding is disabled.
 */
const ensureHardwareEventsSeeded = () => {
    // Zero demo data policy. Only genuine hardware events captured from workstations exist.
};
exports.ensureHardwareEventsSeeded = ensureHardwareEventsSeeded;
/**
 * Helper to check if a laboratory is within the caller's assigned scope.
 */
const isLabInScope = (user, labId, labCode) => {
    if (user.role === 'ADMIN')
        return true;
    if (!user.assignedLabs || user.assignedLabs.length === 0)
        return false;
    return user.assignedLabs.some((al) => (labId && al.toLowerCase() === labId.toLowerCase()) ||
        (labCode && al.toLowerCase() === labCode.toLowerCase()));
};
exports.isLabInScope = isLabInScope;
/**
 * GET /api/assistant/dashboard
 * Aggregates operational KPIs for the authenticated lab assistant across assigned facilities.
 */
const getAssistantDashboard = async (req, res) => {
    (0, labController_1.ensureLabsSeeded)();
    (0, exports.ensureHardwareEventsSeeded)();
    const user = req.user;
    const allLabs = pool_1.db.getStore('labs');
    // Filter labs according to assistant assignment
    let assignedLabs = allLabs;
    if (user.role !== 'ADMIN') {
        if (user.assignedLabs && user.assignedLabs.length > 0) {
            assignedLabs = allLabs.filter((l) => (0, exports.isLabInScope)(user, l.id, l.code));
        }
        else {
            assignedLabs = [];
        }
    }
    const assignedLabIds = new Set(assignedLabs.map((l) => l.id.toLowerCase()));
    const assignedLabCodes = new Set(assignedLabs.map((l) => l.code.toLowerCase()));
    // Workstations in assigned labs
    const allPcs = pool_1.db.getStore('computers');
    const assignedPcs = allPcs.filter((pc) => assignedLabIds.has(pc.labId.toLowerCase()) ||
        (pc.labCode && assignedLabCodes.has(pc.labCode.toLowerCase())));
    let availableWorkstations = 0;
    let occupiedWorkstations = 0;
    let maintenanceWorkstations = 0;
    let disabledWorkstations = 0;
    let offlineWorkstations = 0;
    for (const pc of assignedPcs) {
        if (!pc.isOnline || pc.state === 'OFFLINE') {
            offlineWorkstations++;
        }
        if (pc.state === 'AVAILABLE') {
            availableWorkstations++;
        }
        else if (pc.state === 'IN_USE') {
            occupiedWorkstations++;
        }
        else if (pc.state === 'MAINTENANCE') {
            maintenanceWorkstations++;
        }
        else if (pc.state === 'DISABLED') {
            disabledWorkstations++;
        }
    }
    // Active student sessions in assigned labs
    const allSessions = pool_1.db.getStore('sessions');
    const activeSessions = allSessions.filter((s) => s.status === 'ACTIVE' &&
        (assignedLabIds.has(s.labId?.toLowerCase() || '') ||
            (s.labCode && assignedLabCodes.has(s.labCode.toLowerCase()))));
    // Issues in assigned labs
    const allIssues = pool_1.db.getStore('issues');
    const openIssues = allIssues.filter((i) => i.status !== 'RESOLVED' &&
        (assignedLabIds.has(i.labId?.toLowerCase() || '') ||
            (i.labCode && assignedLabCodes.has(i.labCode.toLowerCase()))));
    // Maintenance records in assigned labs
    const allMaintenance = pool_1.db.getStore('maintenance');
    const activeMaintenance = allMaintenance.filter((m) => m.status !== 'COMPLETED' &&
        (assignedLabIds.has(m.labId.toLowerCase())));
    // Unacknowledged hardware events in assigned labs
    const allHardwareEvents = pool_1.db.getStore('hardware_events');
    const recentHardwareAlerts = allHardwareEvents.filter((e) => !e.acknowledged &&
        (assignedLabIds.has(e.labId.toLowerCase()) ||
            (e.labCode && assignedLabCodes.has(e.labCode.toLowerCase()))));
    // Decorate assigned labs with live metrics
    const decoratedLabs = assignedLabs.map((lab) => ({
        ...lab,
        metrics: (0, labController_1.computeLabMetrics)(lab.id, lab.code)
    }));
    const metrics = {
        assignedLabsCount: assignedLabs.length,
        totalWorkstations: assignedPcs.length,
        availableWorkstations,
        occupiedWorkstations,
        maintenanceWorkstations,
        disabledWorkstations,
        offlineWorkstations,
        activeSessionsCount: activeSessions.length,
        openIssuesCount: openIssues.length,
        activeMaintenanceCount: activeMaintenance.length,
        recentHardwareAlertsCount: recentHardwareAlerts.length,
        assignedLabs: decoratedLabs
    };
    return res.json({
        success: true,
        data: metrics
    });
};
exports.getAssistantDashboard = getAssistantDashboard;
/**
 * GET /api/hardware-events
 * Lists hardware events scoped to the user's assigned laboratories.
 */
const getHardwareEvents = async (req, res) => {
    (0, exports.ensureHardwareEventsSeeded)();
    const user = req.user;
    let events = pool_1.db.getStore('hardware_events');
    // Scoping check for LAB_ASSISTANT and FACULTY
    if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
        if (user.assignedLabs && user.assignedLabs.length > 0) {
            events = events.filter((e) => (0, exports.isLabInScope)(user, e.labId, e.labCode));
        }
        else {
            events = [];
        }
    }
    // Filters
    const { labCode, pcCode, eventType, unacknowledgedOnly, acknowledged, search } = req.query;
    if (labCode && typeof labCode === 'string') {
        events = events.filter((e) => e.labCode.toUpperCase() === labCode.toUpperCase());
    }
    if (pcCode && typeof pcCode === 'string') {
        events = events.filter((e) => e.pcCode.toUpperCase() === pcCode.toUpperCase());
    }
    if (eventType && typeof eventType === 'string') {
        events = events.filter((e) => e.eventType === eventType);
    }
    if (acknowledged !== undefined) {
        const isAck = acknowledged === 'true' || acknowledged === '1';
        events = events.filter((e) => !!e.acknowledged === isAck);
    }
    else if (unacknowledgedOnly === 'true' || unacknowledgedOnly === '1') {
        events = events.filter((e) => !e.acknowledged);
    }
    if (search && typeof search === 'string') {
        const q = search.trim().toLowerCase();
        events = events.filter((e) => e.description.toLowerCase().includes(q) ||
            e.pcCode.toLowerCase().includes(q) ||
            e.labCode.toLowerCase().includes(q) ||
            e.eventType.toLowerCase().includes(q));
    }
    // Sort descending by timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return res.json({
        success: true,
        data: events
    });
};
exports.getHardwareEvents = getHardwareEvents;
/**
 * POST /api/hardware-events
 * Records a new hardware peripheral / connectivity event.
 */
const createHardwareEvent = async (req, res) => {
    (0, exports.ensureHardwareEventsSeeded)();
    const user = req.user;
    const { labCode, pcCode, eventType, description, equipmentId, metadata } = req.body;
    if (!labCode || !pcCode || !eventType || !description) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'labCode, pcCode, eventType, and description are required'
        });
    }
    // Find workstation
    const pc = pool_1.db.findOne('computers', (c) => c.pcCode.toUpperCase() === pcCode.toUpperCase() && c.labCode?.toUpperCase() === labCode.toUpperCase());
    const labId = pc?.labId || (0, uuid_1.v4)();
    // Scoping check for LAB_ASSISTANT
    if (user.role === 'LAB_ASSISTANT' && !(0, exports.isLabInScope)(user, labId, labCode)) {
        return res.status(403).json({
            success: false,
            error: 'FORBIDDEN_SCOPE',
            message: `User is not authorized for laboratory ${labCode}`
        });
    }
    const now = new Date().toISOString();
    const event = {
        id: (0, uuid_1.v4)(),
        clientId: pc ? pc.clientId || `CLIENT-${pc.pcCode}` : `CLIENT-${pcCode}`,
        labId,
        labCode,
        computerId: pc?.id || (0, uuid_1.v4)(),
        pcCode,
        equipmentId,
        eventType: eventType,
        description,
        metadata,
        timestamp: now,
        syncStatus: 'SYNCED',
        acknowledged: false
    };
    pool_1.db.insert('hardware_events', event);
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: user.id,
        actorName: user.fullName,
        role: user.role,
        action: 'HARDWARE_EVENT_LOGGED',
        entityType: 'HARDWARE',
        entityId: event.id,
        details: `${eventType}: ${description} (${labCode} - ${pcCode})`,
        timestamp: now
    });
    // Realtime Gateway Broadcast
    realtimeService_1.RealtimeService.broadcastHardwareAlert(event);
    return res.status(201).json({
        success: true,
        data: event
    });
};
exports.createHardwareEvent = createHardwareEvent;
/**
 * PATCH /api/hardware-events/:id/acknowledge
 * Acknowledges a hardware event.
 */
const acknowledgeHardwareEvent = async (req, res) => {
    (0, exports.ensureHardwareEventsSeeded)();
    const user = req.user;
    const { id } = req.params;
    const event = pool_1.db.findOne('hardware_events', (e) => e.id === id);
    if (!event) {
        return res.status(404).json({
            success: false,
            error: 'NOT_FOUND',
            message: 'Hardware event not found'
        });
    }
    if (user.role === 'LAB_ASSISTANT' && !(0, exports.isLabInScope)(user, event.labId, event.labCode)) {
        return res.status(403).json({
            success: false,
            error: 'FORBIDDEN_SCOPE',
            message: 'User is not authorized for the laboratory associated with this event'
        });
    }
    const now = new Date().toISOString();
    event.acknowledged = true;
    event.acknowledgedBy = user.fullName;
    event.acknowledgedAt = now;
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: user.id,
        actorName: user.fullName,
        role: user.role,
        action: 'HARDWARE_EVENT_ACKNOWLEDGED',
        entityType: 'HARDWARE',
        entityId: event.id,
        timestamp: now
    });
    return res.json({
        success: true,
        data: event
    });
};
exports.acknowledgeHardwareEvent = acknowledgeHardwareEvent;
/**
 * POST /api/maintenance
 * Creates a maintenance record for a workstation or peripheral.
 */
const createMaintenanceRecord = async (req, res) => {
    (0, labController_1.ensureLabsSeeded)();
    const user = req.user;
    const { computerId, equipmentId, issueId, actionTaken, responsibleUser, cost, status, notes } = req.body;
    const labId = req.body.labId || req.body.labCode;
    if (!labId || !computerId || !actionTaken) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'labId (or labCode), computerId, and actionTaken are required'
        });
    }
    // Find lab to check scope
    const lab = pool_1.db.findOne('labs', (l) => l.id === labId || l.code.toUpperCase() === labId.toUpperCase());
    const actualLabId = lab?.id || labId;
    const actualLabCode = lab?.code || labId;
    if (user.role === 'LAB_ASSISTANT' && !(0, exports.isLabInScope)(user, actualLabId, actualLabCode)) {
        return res.status(403).json({
            success: false,
            error: 'FORBIDDEN_SCOPE',
            message: 'User is not authorized for the requested laboratory'
        });
    }
    // Find computer
    const pc = pool_1.db.findOne('computers', (c) => c.id === computerId || c.pcCode.toUpperCase() === computerId.toUpperCase());
    const actualComputerId = pc?.id || computerId;
    const now = new Date().toISOString();
    const maintenanceStatus = status || 'IN_PROGRESS';
    const record = {
        id: (0, uuid_1.v4)(),
        issueId,
        labId: actualLabId,
        computerId: actualComputerId,
        equipmentId,
        responsibleUser: responsibleUser || user.fullName,
        actionTaken,
        cost: typeof cost === 'number' ? cost : 0,
        startTime: now,
        status: maintenanceStatus,
        notes
    };
    pool_1.db.insert('maintenance', record);
    // If workstation is attached and maintenance is active, set PC state to MAINTENANCE
    if (maintenanceStatus === 'IN_PROGRESS' || maintenanceStatus === 'SCHEDULED') {
        pool_1.db.update('computers', (c) => c.id === actualComputerId || c.pcCode.toUpperCase() === computerId.toUpperCase(), {
            state: 'MAINTENANCE'
        });
    }
    // If issueId was provided, update issue status to MAINTENANCE
    if (issueId) {
        pool_1.db.update('issues', (i) => i.id === issueId, {
            status: 'MAINTENANCE',
            updatedAt: now
        });
    }
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: user.id,
        actorName: user.fullName,
        role: user.role,
        action: 'MAINTENANCE_CREATED',
        entityType: 'MAINTENANCE',
        entityId: record.id,
        timestamp: now
    });
    // Realtime Gateway Broadcast
    realtimeService_1.RealtimeService.broadcastMaintenanceUpdate(record);
    return res.status(201).json({
        success: true,
        data: record
    });
};
exports.createMaintenanceRecord = createMaintenanceRecord;
/**
 * PATCH /api/maintenance/:id
 * Updates or completes a maintenance work order.
 */
const updateMaintenanceRecord = async (req, res) => {
    (0, labController_1.ensureLabsSeeded)();
    const user = req.user;
    const { id } = req.params;
    const { actionTaken, responsibleUser, cost, status, notes } = req.body;
    const record = pool_1.db.findOne('maintenance', (m) => m.id === id);
    if (!record) {
        return res.status(404).json({
            success: false,
            error: 'NOT_FOUND',
            message: 'Maintenance record not found'
        });
    }
    if (user.role === 'LAB_ASSISTANT' && !(0, exports.isLabInScope)(user, record.labId)) {
        return res.status(403).json({
            success: false,
            error: 'FORBIDDEN_SCOPE',
            message: 'User is not authorized for the laboratory associated with this maintenance record'
        });
    }
    const now = new Date().toISOString();
    if (actionTaken)
        record.actionTaken = actionTaken;
    if (responsibleUser)
        record.responsibleUser = responsibleUser;
    if (typeof cost === 'number')
        record.cost = cost;
    if (notes !== undefined)
        record.notes = notes;
    if (status) {
        record.status = status;
        if (status === 'COMPLETED') {
            record.endTime = now;
            // When maintenance completes, check if this PC has any other ongoing maintenance
            const otherActive = pool_1.db.findOne('maintenance', (m) => m.id !== id && (m.computerId === record.computerId || m.computerId.toUpperCase() === record.computerId.toUpperCase()) && (m.status === 'IN_PROGRESS' || m.status === 'SCHEDULED'));
            if (!otherActive) {
                pool_1.db.update('computers', (c) => c.id === record.computerId || c.pcCode.toUpperCase() === record.computerId.toUpperCase(), {
                    state: 'AVAILABLE'
                });
            }
            // If tied to an issue, mark issue resolved
            if (record.issueId) {
                pool_1.db.update('issues', (i) => i.id === record.issueId, {
                    status: 'RESOLVED',
                    updatedAt: now
                });
            }
        }
    }
    pool_1.db.insert('audit_logs', {
        id: (0, uuid_1.v4)(),
        actorUserId: user.id,
        actorName: user.fullName,
        role: user.role,
        action: 'MAINTENANCE_UPDATED',
        entityType: 'MAINTENANCE',
        entityId: record.id,
        timestamp: now
    });
    // Realtime Gateway Broadcast
    realtimeService_1.RealtimeService.broadcastMaintenanceUpdate(record);
    return res.json({
        success: true,
        data: record
    });
};
exports.updateMaintenanceRecord = updateMaintenanceRecord;
/**
 * GET /api/maintenance/stats
 * Aggregates maintenance metrics across assigned labs.
 */
const getMaintenanceStats = async (req, res) => {
    (0, labController_1.ensureLabsSeeded)();
    const user = req.user;
    let records = pool_1.db.getStore('maintenance');
    if (user.role === 'LAB_ASSISTANT' || user.role === 'FACULTY') {
        if (user.assignedLabs && user.assignedLabs.length > 0) {
            records = records.filter((m) => (0, exports.isLabInScope)(user, m.labId));
        }
    }
    const inProgress = records.filter((m) => m.status === 'IN_PROGRESS').length;
    const scheduled = records.filter((m) => m.status === 'SCHEDULED').length;
    const completed = records.filter((m) => m.status === 'COMPLETED').length;
    const cancelled = records.filter((m) => m.status === 'CANCELLED').length;
    const totalCost = records.reduce((acc, curr) => acc + (curr.cost || 0), 0);
    return res.json({
        success: true,
        data: {
            total: records.length,
            inProgress,
            scheduled,
            completed,
            cancelled,
            totalCost
        }
    });
};
exports.getMaintenanceStats = getMaintenanceStats;
/**
 * GET /api/maintenance/:id
 * Retrieves specific maintenance work order by ID.
 */
const getMaintenanceById = async (req, res) => {
    (0, labController_1.ensureLabsSeeded)();
    const user = req.user;
    const { id } = req.params;
    const record = pool_1.db.findOne('maintenance', (m) => m.id === id);
    if (!record) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Maintenance record not found' });
    }
    if (user.role === 'LAB_ASSISTANT' && !(0, exports.isLabInScope)(user, record.labId)) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN_SCOPE', message: 'Unauthorized for this laboratory' });
    }
    const workstation = pool_1.db.findOne('computers', (c) => c.id === record.computerId || c.pcCode.toUpperCase() === record.computerId.toUpperCase());
    const equipment = record.equipmentId ? pool_1.db.findOne('equipment', (e) => e.id === record.equipmentId) : null;
    const linkedIssue = record.issueId ? pool_1.db.findOne('issues', (i) => i.id === record.issueId) : null;
    return res.json({
        success: true,
        data: {
            record,
            workstation,
            equipment,
            linkedIssue
        }
    });
};
exports.getMaintenanceById = getMaintenanceById;
/**
 * POST /api/maintenance/:id/cancel
 * Cancels a maintenance work order and restores PC if appropriate.
 */
const cancelMaintenanceRecord = async (req, res) => {
    (0, labController_1.ensureLabsSeeded)();
    const user = req.user;
    const { id } = req.params;
    const { reason } = req.body;
    const record = pool_1.db.findOne('maintenance', (m) => m.id === id);
    if (!record) {
        return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Maintenance record not found' });
    }
    if (user.role === 'LAB_ASSISTANT' && !(0, exports.isLabInScope)(user, record.labId)) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN_SCOPE', message: 'Unauthorized for this laboratory' });
    }
    const now = new Date().toISOString();
    record.status = 'CANCELLED';
    record.notes = reason ? `${record.notes || ''} [CANCELLED: ${reason}]` : record.notes;
    record.endTime = now;
    // Restore PC state to AVAILABLE if no other active maintenance
    const otherActive = pool_1.db.findOne('maintenance', (m) => m.id !== id && (m.computerId === record.computerId || m.computerId.toUpperCase() === record.computerId.toUpperCase()) && (m.status === 'IN_PROGRESS' || m.status === 'SCHEDULED'));
    if (!otherActive) {
        pool_1.db.update('computers', (c) => c.id === record.computerId || c.pcCode.toUpperCase() === record.computerId.toUpperCase(), {
            state: 'AVAILABLE'
        });
    }
    // Realtime Gateway Broadcast
    realtimeService_1.RealtimeService.broadcastMaintenanceUpdate(record);
    return res.json({
        success: true,
        data: record,
        message: 'Maintenance order cancelled'
    });
};
exports.cancelMaintenanceRecord = cancelMaintenanceRecord;
